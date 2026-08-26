#!/usr/bin/env node
/**
 * Production bin entrypoint for the `grill-board` package.
 *
 * Uses Effect v4 RC + @effect/platform-node to serve static assets from
 * dist/client/ and proxy all other requests to the SSR fetch handler from
 * dist/server/server.js.
 *
 * Subcommands:
 *   grill-board init      — register MCP + install skill in detected agent clients
 *   grill-board --version — print version and exit
 *   grill-board           — start the production server
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as Effect from "effect/Effect";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";

import { autoMigrateLegacyDb, guardDowngrade } from "../server/db/guard.js";
import { getDb } from "../server/db/connection.js";
import { seedIfEmpty } from "../server/db/seed.js";

// ---------------------------------------------------------------------------
// Paths — resolved relative to this file's location in dist/bin/
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, "..");
const CLIENT_DIR = join(DIST_DIR, "client");
const SERVER_ENTRY = join(DIST_DIR, "server", "server.js");

// ---------------------------------------------------------------------------
// --version / -v
// ---------------------------------------------------------------------------

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  const pkgPath = resolve(__dirname, "..", "..", "package.json");
  const pkg = JSON.parse((await import("node:fs")).readFileSync(pkgPath, "utf-8")) as {
    version: string;
  };
  console.log(pkg.version);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Subcommand routing
// ---------------------------------------------------------------------------

const subcommand = process.argv[2];

switch (subcommand) {
  case "init": {
    const { init } = await import("./init.js");
    init();
    process.exit(0);
    break;
  }

  case undefined:
  case "--port":
    // Fall through to server startup below.
    break;

  default:
    console.error(`Unknown command: ${subcommand}`);
    console.error("Run `grill-board --help` for usage.");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

// ---------------------------------------------------------------------------
// Free-port fallback
// ---------------------------------------------------------------------------

function tryListen(server: import("node:http").Server, port: number): Promise<number> {
  return new Promise((ok, fail) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Port busy — let the OS assign a free port.
        server.listen(0, () => {
          const addr = server.address();
          if (addr && typeof addr === "object") ok(addr.port);
          else fail(new Error("Could not determine bound port"));
        });
      } else {
        fail(err);
      }
    });
    server.listen(port, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") ok(addr.port);
      else fail(new Error("Could not determine bound port"));
    });
  });
}

// ---------------------------------------------------------------------------
// Shell alias helpers (ADR 0007)
// ---------------------------------------------------------------------------

function shellConfigFile(): string | null {
  const shell = process.env.SHELL ?? "";
  const home = process.env.HOME ?? "";
  if (!home) return null;
  if (shell.endsWith("/zsh")) return join(home, ".zshrc");
  if (shell.endsWith("/bash")) {
    const bashrc = join(home, ".bashrc");
    const profile = join(home, ".bash_profile");
    return existsSync(bashrc) ? bashrc : profile;
  }
  if (shell.endsWith("/fish")) return join(home, ".config", "fish", "config.fish");
  return null;
}

function printShellAliasHint(): void {
  const rc = shellConfigFile();
  if (!rc) return;
  console.log(
    `\nTip: add an alias for quick access:\n  echo 'alias grill="npx grill-board"' >> ${rc}\n`,
  );
}

// ---------------------------------------------------------------------------
// Main program
// ---------------------------------------------------------------------------

const program = Effect.gen(function* () {
  // Track C: legacy DB migration + downgrade guard
  autoMigrateLegacyDb();
  guardDowngrade();

  // Ensure DB is initialized and migrated
  getDb();

  // ADR 0010: first-boot tutorial topic seed on empty DB
  seedIfEmpty();

  // Import the SSR handler (WinterCG fetch)
  const ssrModule = (yield* Effect.promise(() => import(SERVER_ENTRY))) as {
    default: (request: Request) => Response | Promise<Response>;
  };
  const ssrHandler = ssrModule.default;

  // Preferred port: --port flag, PORT env, or 3000
  const portArg = process.argv.indexOf("--port");
  const preferredPort =
    portArg !== -1 && process.argv[portArg + 1]
      ? Number(process.argv[portArg + 1])
      : Number(process.env.PORT) || 3000;

  // Create the Node HTTP server
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // Try serving static assets from dist/client/
    const filePath = join(CLIENT_DIR, decodeURIComponent(url.pathname));
    const normalizedPath = resolve(filePath);

    // Directory traversal guard
    if (normalizedPath.startsWith(CLIENT_DIR) && existsSync(normalizedPath)) {
      const stat = statSync(normalizedPath);
      if (stat.isFile()) {
        const ext = extname(normalizedPath);
        const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": stat.size,
          "Cache-Control": normalizedPath.includes("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=0, must-revalidate",
        });
        createReadStream(normalizedPath).pipe(res);
        return;
      }
    }

    // Forward to SSR handler
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }

    const webRequest = new Request(url.href, {
      method: req.method,
      headers,
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? (req as unknown as ReadableStream)
          : undefined,
      // @ts-expect-error -- Node 22+ supports duplex on Request
      duplex: req.method !== "GET" && req.method !== "HEAD" ? "half" : undefined,
    });

    try {
      const webResponse = await ssrHandler(webRequest);
      res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
      if (webResponse.body) {
        const reader = webResponse.body.getReader();
        const pump = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(value);
          await pump();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (err) {
      console.error("SSR handler error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
      }
      res.end("Internal Server Error");
    }
  });

  const boundPort = yield* Effect.promise(() => tryListen(server, preferredPort));
  const baseUrl = `http://localhost:${boundPort}`;

  console.log(`\n  grill-board listening on ${baseUrl}\n`);

  // MCP registration hint (user story 18)
  console.log("  Register this MCP server in your agent client:");
  console.log(`    npx grill-board init\n`);
  console.log(`  Or add manually to your MCP config:`);
  console.log(`    "grill-board": { "command": "npx", "args": ["grill-board"] }\n`);

  // Shell alias hint (ADR 0007)
  printShellAliasHint();

  // Keep running until interrupted
  yield* Effect.never;
});

NodeRuntime.runMain()(program);
