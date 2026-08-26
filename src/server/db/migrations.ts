import type { Database } from "better-sqlite3";

/**
 * Schema migrations.
 *
 * A migration is a version number plus one SQL script. The runner applies every
 * script whose version is above the version recorded in `schema_version`, each
 * one inside a transaction, and records the new version. Append new versions to
 * the end of the list; never edit a script that already shipped.
 */
interface Migration {
  version: number;
  sql: string;
}

/**
 * Version 1 — the full schema.
 *
 * One deviation from the spec DDL: `questions` has a composite primary key
 * `(topic_id, id)`. The exposed question id stays the short one (`q1`) and is
 * unique inside its topic, which is what every API and MCP tool is keyed on.
 */
const MIGRATIONS: ReadonlyArray<Migration> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS topics (
        id           TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        context      TEXT,
        categories   TEXT NOT NULL,
        status       TEXT NOT NULL
                       CHECK (status IN ('active','archived')) DEFAULT 'active',
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rounds (
        id           TEXT PRIMARY KEY,
        topic_id     TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        number       INTEGER NOT NULL,
        title        TEXT,
        created_at   INTEGER NOT NULL,
        UNIQUE (topic_id, number)
      );

      CREATE TABLE IF NOT EXISTS questions (
        id             TEXT NOT NULL,
        topic_id       TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        round_id       TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
        category       TEXT NOT NULL,
        status         TEXT NOT NULL
                         CHECK (status IN ('open','answered','suspended','pending_facts')),
        text           TEXT NOT NULL,
        recommendation TEXT,
        options        TEXT,
        note           TEXT,
        answer         TEXT,
        answered_via   TEXT CHECK (answered_via IN ('chat','board')),
        draft          TEXT,
        position       INTEGER NOT NULL DEFAULT 0,
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL,
        PRIMARY KEY (topic_id, id)
      );

      CREATE INDEX IF NOT EXISTS questions_topic_idx
        ON questions(topic_id, round_id, category);
    `,
  },
  {
    /** Version 2 — which quick-pick option the agent recommends. */
    version: 2,
    sql: `ALTER TABLE questions ADD COLUMN recommended_option TEXT;`,
  },
  {
    /** Version 3 — confirmation rounds: kind + markdown synthesis. */
    version: 3,
    sql: `
      ALTER TABLE rounds ADD COLUMN kind TEXT NOT NULL
        CHECK (kind IN ('grill','confirmation')) DEFAULT 'grill';
      ALTER TABLE rounds ADD COLUMN synthesis TEXT;
    `,
  },
];

/** The highest migration version the running code knows about. */
export const LATEST_VERSION: number = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/** Bring the database up to the latest schema version. Safe to call on every open. */
export function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id      INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL
    );
  `);

  const row = db
    .prepare<[], { version: number }>("SELECT version FROM schema_version WHERE id = 1")
    .get();
  const current = row?.version ?? 0;

  const setVersion = db.prepare<[number]>(
    "INSERT INTO schema_version (id, version) VALUES (1, ?) " +
      "ON CONFLICT(id) DO UPDATE SET version = excluded.version",
  );

  const apply = db.transaction((migration: Migration) => {
    db.exec(migration.sql);
    setVersion.run(migration.version);
  });

  for (const migration of MIGRATIONS) {
    if (migration.version > current) apply(migration);
  }
}
