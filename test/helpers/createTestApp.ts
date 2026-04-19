import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import cors from "cors";
import type { Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import { z } from "zod";
import { registerAllTools } from "../../src/tools/index.js";

interface TestAppOptions {
  mode?: "fhir" | "fixture";
  apiKeys?: string;
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<{ server: Server; baseUrl: string }> {
  const mode = options.mode ?? "fhir";
  const apiKeys = options.apiKeys ?? "";

  const app = createMcpExpressApp({
    host: "127.0.0.1",
  });

  app.use(cors({ origin: "*" }));

  function testAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const validKeys = apiKeys
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (validKeys.length === 0) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res
        .status(401)
        .json({ error: "Unauthorized", message: "Missing Authorization" });
      return;
    }

    const match = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (!match?.[1] || !validKeys.includes(match[1])) {
      res
        .status(401)
        .json({ error: "Unauthorized", message: "Invalid API key" });
      return;
    }

    next();
  }

  function testSharpMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (mode === "fixture") {
      next();
      return;
    }

    const fhirServerUrl = req.headers["x-fhir-server-url"];
    if (!fhirServerUrl) {
      res.status(403).json({
        error: "Forbidden",
        message: "Missing required FHIR context headers.",
      });
      return;
    }

    next();
  }

  app.post(
    "/mcp",
    testAuthMiddleware,
    testSharpMiddleware,
    async (req: Request, res: Response) => {
      try {
        const server = new McpServer(
          { name: "CareGap MCP", version: "0.1.0" },
          {
            capabilities: {
              logging: {},
              experimental: {
                fhir_context_required: { value: true },
              },
              extensions: {
                "ai.promptopinion/fhir-context": {
                  scopes: [
                    { name: "patient/Patient.rs", required: true },
                    { name: "patient/Observation.rs" },
                    { name: "patient/Condition.rs" },
                  ],
                },
              },
            },
          },
        );

        registerAllTools(server, req);

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
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    },
  );

  return new Promise((resolve) => {
    const httpServer = app.listen(0, () => {
      const addr = httpServer.address();
      const port =
        typeof addr === "object" && addr !== null ? addr.port : 3333;
      resolve({
        server: httpServer,
        baseUrl: `http://127.0.0.1:${port}`,
      });
    });
  });
}
