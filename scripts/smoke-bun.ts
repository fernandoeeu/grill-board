/**
 * `pnpm smoke:bun` — the built `grill-board/core` entry under Bun, on a temp
 * `bun:sqlite` file: migrations twice, then topic → round → question → answer
 * → export. Run `pnpm build` first.
 */
// @ts-nocheck: `bun:sqlite` has no types in this Node project.
import { Database } from "bun:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGrillCore, grillTools, migrate, schemaVersion } from "grill-board/core";

const file = join(mkdtempSync(join(tmpdir(), "grill-core-")), "grill.db");
const db = new Database(file, { strict: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

migrate(db);
migrate(db);

const grill = createGrillCore(db);
const topic = grill.createTopic({ title: "Smoke under Bun", categories: ["runtime"] });
const round = grill.createRound(topic.id);
grill.addQuestions(topic.id, round.id, [{ category: "runtime", text: "Does bun:sqlite fit?" }]);
console.log(`pending ${grill.listPendingQuestions({ topicId: topic.id }).length}`);
grill.answerQuestion(topic.id, "q1", "Yes", "chat");

const tool = grillTools(grill).find((candidate) => candidate.name === "export_answers");
const viaTool = tool.handler({ topicId: topic.id, format: "json" });

console.log(`schema ${schemaVersion(db)} at ${file}`);
console.log(grill.exportAnswers(topic.id));
console.log(viaTool.content[0].text);
