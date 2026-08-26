import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import Database, { type Database as SqliteDatabase } from "better-sqlite3";
import { migrate } from "./migrations";

/** XDG-compliant default: $XDG_DATA_HOME/grill-board/grill-board.db */
const DEFAULT_DB_PATH = join(
  process.env.XDG_DATA_HOME?.trim() || join(homedir(), ".local", "share"),
  "grill-board",
  "grill-board.db",
);

declare global {
  // Cached on globalThis so the Vite dev server keeps one connection across HMR.
  // eslint-disable-next-line no-var
  var __grillBoardDb: SqliteDatabase | undefined;
}

// A new migration arrives over HMR while the connection is already cached, so
// the fresh module must bring that cached connection up to date. Idempotent.
if (globalThis.__grillBoardDb !== undefined) migrate(globalThis.__grillBoardDb);

/**
 * The single database connection of the process.
 *
 * The first call resolves the file path, creates its directory, opens the
 * database, sets the pragmas and runs the migrations. Every later call returns
 * the same connection — never open a second one.
 */
export function getDb(): SqliteDatabase {
  const cached = globalThis.__grillBoardDb;
  if (cached !== undefined) return cached;

  const database = open();
  migrate(database);
  globalThis.__grillBoardDb = database;
  return database;
}

function open(): SqliteDatabase {
  const file = databaseFile();
  mkdirSync(dirname(file), { recursive: true });

  const database = new Database(file);
  database.pragma("journal_mode = WAL"); // many readers, one writer
  database.pragma("foreign_keys = ON"); // per connection, so set it on every open
  database.pragma("busy_timeout = 5000"); // `pnpm seed` can run beside `pnpm dev`
  database.pragma("synchronous = NORMAL"); // safe under WAL, much faster commits
  return database;
}

export function databaseFile(): string {
  const override = process.env.GRILL_BOARD_DB?.trim();
  return resolve(override !== undefined && override !== "" ? override : DEFAULT_DB_PATH);
}
