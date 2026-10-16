/**
 * The database seam of the core.
 *
 * The core never opens a file, reads an environment variable or caches a
 * connection. The host hands it an open SQLite connection that satisfies
 * `SqliteDatabase`, and every call is synchronous. Two drivers fit as they are:
 *
 * - `better-sqlite3` (`new Database(file)`), which the local app uses;
 * - `bun:sqlite` opened with `{ strict: true }`, so named parameters bind
 *   without their `@` / `:` prefix, exactly as in better-sqlite3.
 */

/** A prepared statement. Positional values, or one object of named values. */
export interface SqliteStatement {
  run(...params: any[]): { changes: number };
  get(...params: any[]): unknown;
  all(...params: any[]): unknown[];
}

/** The smallest connection surface the core needs. */
export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): unknown;
}

type Args<P> = P extends unknown[] ? P : [P];

/** A statement typed by its bind values `P` and its row shape `R`. */
export interface Statement<P, R> {
  run(...params: Args<P>): { changes: number };
  get(...params: Args<P>): R | undefined;
  all(...params: Args<P>): R[];
}

/**
 * The connection as the data-access code sees it: typed statements, a missing
 * row is always `undefined` (bun:sqlite says `null`), and transactions run on
 * savepoints so they nest and need nothing from the driver.
 */
export interface Db {
  prepare<P = unknown[], R = unknown>(sql: string): Statement<P, R>;
  exec(sql: string): void;
  /** Wraps `fn`; calling the result runs it in one transaction. */
  transaction<T>(fn: () => T): () => T;
}

export function toDb(raw: SqliteDatabase): Db {
  return {
    prepare<P, R>(sql: string): Statement<P, R> {
      const statement = raw.prepare(sql);
      return {
        run: (...params) => statement.run(...params),
        get: (...params) => (statement.get(...params) ?? undefined) as R | undefined,
        all: (...params) => statement.all(...params) as R[],
      };
    },
    exec(sql) {
      raw.exec(sql);
    },
    transaction<T>(fn: () => T): () => T {
      return () => {
        raw.exec("SAVEPOINT grill_board");
        try {
          const result = fn();
          raw.exec("RELEASE grill_board");
          return result;
        } catch (error) {
          raw.exec("ROLLBACK TO grill_board");
          raw.exec("RELEASE grill_board");
          throw error;
        }
      };
    },
  };
}
