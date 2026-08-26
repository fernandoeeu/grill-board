/**
 * `pnpm seed` — create the database if needed and import the seed topic.
 *
 * Safe to run any number of times: the import is skipped when the topic is
 * already there.
 */
import { getTopic, seedIfEmpty } from "@/server/db";
import { seedTopic } from "@/server/db/seed-data";

seedIfEmpty();

const topic = getTopic(seedTopic.id);

if (topic === null) {
  console.error(`seed failed: no topic '${seedTopic.id}' after seeding`);
  process.exit(1);
}

console.log(
  `seeded '${topic.id}': ${topic.questions.length} questions, ${topic.rounds.length} rounds, ${topic.progress.done}/${topic.progress.total} done`,
);
