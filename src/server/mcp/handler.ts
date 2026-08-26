/**
 * The Grill Board MCP endpoint.
 *
 * Stateless Streamable HTTP, spec revision 2026-07-28, served by
 * `@modelcontextprotocol/server@2.0.0`. There are no sessions and no
 * `initialize` handshake in this revision: the SDK answers `server/discover`,
 * every request carries its own protocol version, and GET / DELETE on the
 * endpoint are refused with 405 — there is no SSE stream to open.
 *
 * The handler is built once per process; its factory runs once per HTTP
 * request and builds a fresh `McpServer`. That is cheap and correct: all the
 * state lives in SQLite behind `@/server/db`, keyed by topic id.
 */

import {
  McpServer,
  createMcpHandler,
  localhostAllowedOrigins,
  originValidationResponse,
} from '@modelcontextprotocol/server';
import { registerGrillTools } from './tools';

function buildServer(): McpServer {
  const server = new McpServer(
    { name: 'grill-board', version: '1.0.0' },
    // The tool list never changes at runtime, so let clients hold it briefly.
    { cacheHints: { 'tools/list': { ttlMs: 30_000, cacheScope: 'private' } } },
  );
  registerGrillTools(server);
  return server;
}

const handler = createMcpHandler(() => buildServer(), {
  // Serve 2025-era clients over the same stateless transport instead of
  // rejecting them. Still no session ids, still not the deprecated HTTP+SSE
  // transport.
  legacy: 'stateless',
  onerror: (error) => {
    console.error('[mcp]', error);
  },
});

// Localhost-only app: refuse a cross-site Origin. A request with no Origin
// header (every MCP client, curl) passes, and so does the app's own browser UI.
const allowedOrigins = localhostAllowedOrigins();

/** Serves one HTTP request on `/mcp`. */
export function handleMcpRequest(request: Request): Promise<Response> {
  const rejected = originValidationResponse(request, allowedOrigins);
  if (rejected !== undefined) {
    return Promise.resolve(rejected);
  }

  // Guard: POST must carry the Accept header that Streamable HTTP clients send.
  // Real MCP clients always include both application/json and text/event-stream;
  // raw curl/fetch rarely does. Catch misuse early with an actionable message.
  if (request.method === 'POST') {
    const accept = request.headers.get('accept') ?? '';
    if (
      !accept.includes('application/json') ||
      !accept.includes('text/event-stream')
    ) {
      return Promise.resolve(
        Response.json(
          {
            error:
              'Use a registered MCP client for this endpoint, not raw HTTP. ' +
              'Register with: claude mcp add --transport http grill-board http://localhost:3000/mcp',
          },
          { status: 400 },
        ),
      );
    }
  }

  return handler.fetch(request);
}
