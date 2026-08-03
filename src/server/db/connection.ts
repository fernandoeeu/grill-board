import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { migrate } from './migrations';

/** Default location, overridable with the `GRILL_BOARD_DB` environment variable. */
const DEFAULT_DB_PATH = 'data/grill-board.db';

declare global {
  // Cached on globalThis so the Vite dev server keeps one connection across HMR.
  // eslint-disable-next-line no-var
  var __grillBoardDb: SqliteDatabase | undefined;
}

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
  database.pragma('journal_mode = WAL'); // many readers, one writer
  database.pragma('foreign_keys = ON'); // per connection, so set it on every open
  database.pragma('busy_timeout = 5000'); // `pnpm seed` can run beside `pnpm dev`
  database.pragma('synchronous = NORMAL'); // safe under WAL, much faster commits
  return database;
}

function databaseFile(): string {
  const override = process.env.GRILL_BOARD_DB?.trim();
  return resolve(override !== undefined && override !== '' ? override : DEFAULT_DB_PATH);
}
