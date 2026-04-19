import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { config } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import { sharpContextMiddleware } from "./middleware/sharpContext.js";
import { createCareGapServer } from "./server.js";
import { logger } from "./util/logger.js";

const app = createMcpExpressApp({
  host: "0.0.0.0",
  allowedHosts: ["localhost", "127.0.0.1", "caregap-mcp.fly.dev"],
});

app.use(
  cors({
    exposedHeaders: [
      "Mcp-Session-Id",
      "Mcp-Protocol-Version",
      "Last-Event-Id",
    ],
    origin: "*",
  }),
);

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    mode: config.MCP_MODE,
    version: "0.1.0",
  });
});

app.post(
  "/mcp",
  authMiddleware,
  sharpContextMiddleware,
  async (req: Request, res: Response) => {
    try {
      const server = createCareGapServer(req);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error({ err: error }, "Error handling MCP request");
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  },
);

app.listen(config.PORT, () => {
  logger.info(
    `CareGap MCP server listening on port ${config.PORT} (mode: ${config.MCP_MODE})`,
  );
});

process.on("SIGINT", () => {
  logger.info("Shutting down...");
  process.exit(0);
});
