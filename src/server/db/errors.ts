/**
 * Errors thrown by the data-access layer.
 *
 * Messages are written for an agent reading a failed MCP tool call: say what
 * was not found and which tool to call next. Never leak SQL or stack traces.
 */

/** A topic, round or question id does not exist. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";

  constructor(message: string) {
    super(message);
  }
}

/*
 * The three `dal-*` modules all report the same three lookup failures. The
 * wording is part of the agent-facing contract, so it is built here once
 * instead of being retyped in every module.
 */

export function topicNotFound(topicId: string): NotFoundError {
  return new NotFoundError(`no topic with id '${topicId}'; call list_topics`);
}

export function roundNotFound(topicId: string, roundId: string): NotFoundError {
  return new NotFoundError(`no round with id '${roundId}' in topic '${topicId}'; call get_topic`);
}

export function questionNotFound(topicId: string, questionId: string): NotFoundError {
  return new NotFoundError(`no question '${questionId}' in topic '${topicId}'; call get_topic`);
}
