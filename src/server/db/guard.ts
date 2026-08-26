import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { databaseFile } from "./connection";
import { LATEST_VERSION } from "./migrations";

/** Legacy DB path used before the XDG migration. */
const LEGACY_DB_PATH = "data/grill-board.db";

/**
 * Copy a legacy `data/grill-board.db` (relative to cwd) to the global XDG
 * location on first run. Idempotent: does nothing when the global DB already
 * exists or the legacy file is absent.
 */
export function autoMigrateLegacyDb(): void {
  const globalPath = databaseFile();
  if (existsSync(globalPath)) return;

  const legacyPath = resolve(LEGACY_DB_PATH);
  if (!existsSync(legacyPath)) return;

  mkdirSync(dirname(globalPath), { recursive: true });
  copyFileSync(legacyPath, globalPath);
}

/**
 * Abort if the on-disk schema was written by a newer version of grill-board.
 *
 * Reads the `version` column from the `schema_version` table. If it exceeds
 * `LATEST_VERSION` (the highest migration the running code knows about), prints
 * a clear upgrade message and exits with code 1.
 */
export function guardDowngrade(): void {
  const file = databaseFile();
  if (!existsSync(file)) return; // fresh install, nothing to guard

  const db = new Database(file, { readonly: true });
  try {
    const tableExists = db
      .prepare<[], { cnt: number }>(
        "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type = 'table' AND name = 'schema_version'",
      )
      .get();

    if (!tableExists || tableExists.cnt === 0) return;

    const row = db
      .prepare<[], { version: number }>("SELECT version FROM schema_version WHERE id = 1")
      .get();
    const dbVersion = row?.version ?? 0;

    if (dbVersion > LATEST_VERSION) {
      console.error(
        `Your database was created by a newer version of grill-board (schema ${dbVersion}, code ${LATEST_VERSION}). ` +
          "Please upgrade: npx grill-board@latest",
      );
      process.exit(1);
    }
  } finally {
    db.close();
  }
}
