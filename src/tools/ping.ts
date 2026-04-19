import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Request } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getFhirContext } from "../middleware/sharpContext.js";

export function registerPingTool(server: McpServer, req: Request): void {
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description:
        "Health-check tool. Returns server status, current mode, and whether FHIR context headers are present.",
      inputSchema: {
        echo: z
          .string()
          .optional()
          .describe("Optional string to echo back in the response"),
      },
      annotations: {
        title: "Ping",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ echo }): Promise<CallToolResult> => {
      const fhirCtx = getFhirContext(req);
      const result = {
        pong: true,
        echo: echo ?? null,
        timestamp: new Date().toISOString(),
        mode: config.MCP_MODE,
        fhirContextPresent: fhirCtx !== null,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
