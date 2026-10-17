/**
 * Errors thrown by the domain rules and the data-access layer.
 *
 * Messages are written for an agent reading a failed MCP tool call: say what
 * was not found and which tool to call next. Never leak SQL or stack traces.
 *
 * Every builder takes the tool-name `prefix` the host registered the tools
 * under (see `grillToolSpecs`), so the recovery hint names a tool the agent
 * can actually call. The default, `""`, gives the historical names.
 */

/** A topic, round or question id does not exist. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";

  constructor(message: string) {
    super(message);
  }
}

/** The name a host registers a base tool name under: `prefix + name`. */
export function toolName(name: string, prefix = ""): string {
  return `${prefix}${name}`;
}

/*
 * Every storage adapter reports the same lookup failures. The wording is part
 * of the agent-facing contract, so it is built here once instead of being
 * retyped in every module.
 */

export function topicNotFound(topicId: string, prefix = ""): NotFoundError {
  return new NotFoundError(
    `no topic with id '${topicId}'; call ${toolName("list_topics", prefix)}`,
  );
}

export function roundNotFound(topicId: string, roundId: string, prefix = ""): NotFoundError {
  return new NotFoundError(
    `no round with id '${roundId}' in topic '${topicId}'; call ${toolName("get_topic", prefix)}`,
  );
}

export function questionNotFound(topicId: string, questionId: string, prefix = ""): NotFoundError {
  return new NotFoundError(
    `no question '${questionId}' in topic '${topicId}'; call ${toolName("get_topic", prefix)}`,
  );
}

/** An explicit topic id that is already taken. */
export function topicIdTaken(topicId: string, prefix = ""): Error {
  return new Error(
    `topic id '${topicId}' already exists; call ${toolName("get_topic", prefix)} or pick another id`,
  );
}

/** An explicit question id that is already taken inside its topic. */
export function questionIdTaken(topicId: string, questionId: string, prefix = ""): Error {
  return new Error(
    `question '${questionId}' already exists in topic '${topicId}'; use ${toolName("update_question", prefix)}`,
  );
}
