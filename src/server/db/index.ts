/**
 * The local app's database: one better-sqlite3 connection per process, the
 * Grill Board core over it, and the first-boot seed. Domain code lives in
 * `src/core`; nothing here speaks SQL.
 */

export { grill } from "./connection.js";
export { seedIfEmpty } from "./seed.js";
