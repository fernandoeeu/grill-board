/**
 * How every Grill Board tool answers.
 *
 * One text block, nothing else. Reads return compact JSON — `JSON.stringify`
 * drops the keys the data-access layer left `undefined`, which is exactly the
 * "no nulls where an absent key will do" shape an agent wants. Failures come
 * back as `isError` results carrying the message and the recovery path, never
 * a stack trace.
 */

import { NotFoundError, toolName } from "../errors.js";

/**
 * The single text block a tool answers with.
 *
 * A type alias, not an interface, on purpose: the SDK's `CallToolResult`
 * carries an index signature, and only an alias gets the implicit one that
 * makes it assignable.
 */
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** A failure an agent can act on: the message names the tool to call next. */
export function fail(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** A successful single-text-block answer. */
export function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

/** Runs one data-access call and hands its already-formatted text back. */
export function textResult(produce: () => string): ToolResult {
  try {
    return ok(produce());
  } catch (error) {
    return failure(error);
  }
}

/** Runs one data-access call and hands its value back as compact JSON. */
export function jsonResult(produce: () => unknown): ToolResult {
  return textResult(() => JSON.stringify(produce()));
}

/** Turns a thrown value into the `isError` result an agent reads. */
export function failure(error: unknown, prefix = ""): ToolResult {
  if (error instanceof NotFoundError) {
    return fail(error.message);
  }
  if (error instanceof Error) {
    // Not a lookup failure, so it is either bad input or a real defect. Log the
    // stack for the operator; give the agent the message alone.
    console.error("[mcp] tool failed:", error);
    return fail(error.message);
  }
  console.error("[mcp] tool failed:", error);
  return fail(
    `the tool failed for an unknown reason; call ${toolName("get_topic", prefix)} to re-read the state`,
  );
}
