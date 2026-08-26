/**
 * `/mcp` — the MCP endpoint, on the same origin and port as the app.
 *
 * A server-only file route: it has handlers and no component. Every method is
 * handed the web-standard `Request` straight to the MCP handler, which answers
 * POST and refuses GET and DELETE with 405 (this revision has no SSE stream).
 */

import { createFileRoute } from "@tanstack/react-router";
import { handleMcpRequest } from "@/server/mcp/handler";

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: ({ request }) => handleMcpRequest(request),
      GET: ({ request }) => handleMcpRequest(request),
      DELETE: ({ request }) => handleMcpRequest(request),
    },
  },
});
