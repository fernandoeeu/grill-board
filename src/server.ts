/**
 * Server entry.
 *
 * It replaces the framework default for one reason: this is the first module
 * the server evaluates, so it is where the database is opened. `seedIfEmpty()`
 * creates `data/grill-board.db` (or `$GRILL_BOARD_DB`), runs the migrations and
 * imports the seed topic on a first boot. It is idempotent, so every later boot
 * only opens the file.
 */

import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { seedIfEmpty } from "@/server/db";

seedIfEmpty();

export default { fetch: createStartHandler(defaultStreamHandler) };
