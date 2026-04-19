import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

let baseUrl: string;
let server: Server;

beforeAll(async () => {
  process.env["MCP_MODE"] = "fhir";
  process.env["PORT"] = "0";
  process.env["MCP_API_KEYS"] = "";
  process.env["LOG_LEVEL"] = "silent";

  const { createTestApp } = await import("./helpers/createTestApp.js");
  const result = await createTestApp();
  server = result.server;
  baseUrl = result.baseUrl;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

function mcpInitializeBody() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  };
}

describe("SHARP-on-MCP conformance", () => {
  describe("FHIR mode header enforcement", () => {
    it("returns 403 when X-FHIR-Server-URL header is missing", async () => {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: { ...MCP_HEADERS },
        body: JSON.stringify(mcpInitializeBody()),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Forbidden");
    });

    it("returns 200 and processes initialize when FHIR headers are present", async () => {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          ...MCP_HEADERS,
          "x-fhir-server-url": "https://fhir.example.com/r4",
          "x-fhir-access-token": "test-token",
          "x-patient-id": "patient-123",
        },
        body: JSON.stringify(mcpInitializeBody()),
      });

      expect(res.status).toBe(200);
    });
  });

  describe("capability advertisement", () => {
    it("includes fhir_context_required in experimental capabilities", async () => {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          ...MCP_HEADERS,
          "x-fhir-server-url": "https://fhir.example.com/r4",
        },
        body: JSON.stringify(mcpInitializeBody()),
      });

      expect(res.status).toBe(200);
      const text = await res.text();

      const initResult = parseResponse(text, 1);
      expect(initResult).not.toBeNull();

      const result = (initResult as Record<string, unknown>)["result"] as {
        capabilities?: {
          experimental?: { fhir_context_required?: { value: boolean } };
          extensions?: Record<string, unknown>;
        };
      };
      expect(result.capabilities?.experimental?.fhir_context_required).toEqual({
        value: true,
      });
      expect(
        result.capabilities?.extensions?.["ai.promptopinion/fhir-context"],
      ).toBeDefined();
    });
  });

  describe("ping tool", () => {
    it("responds to tools/list with ping tool available", async () => {
      const initRes = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          ...MCP_HEADERS,
          "x-fhir-server-url": "https://fhir.example.com/r4",
        },
        body: JSON.stringify(mcpInitializeBody()),
      });
      expect(initRes.status).toBe(200);

      const listRes = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          ...MCP_HEADERS,
          "x-fhir-server-url": "https://fhir.example.com/r4",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      });

      expect(listRes.status).toBe(200);
      const text = await listRes.text();
      const parsed = parseResponse(text, 2);
      expect(parsed).not.toBeNull();

      const result = (parsed as Record<string, unknown>)["result"] as {
        tools: Array<{ name: string }>;
      };
      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain("ping");
    });
  });
});

describe("fixture mode", () => {
  let fixtureServer: Server;
  let fixtureBaseUrl: string;

  beforeAll(async () => {
    const { createTestApp } = await import("./helpers/createTestApp.js");
    const result = await createTestApp({ mode: "fixture" });
    fixtureServer = result.server;
    fixtureBaseUrl = result.baseUrl;
  });

  afterAll(async () => {
    if (fixtureServer) {
      await new Promise<void>((resolve, reject) => {
        fixtureServer.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("does not require FHIR headers in fixture mode", async () => {
    const res = await fetch(`${fixtureBaseUrl}/mcp`, {
      method: "POST",
      headers: { ...MCP_HEADERS },
      body: JSON.stringify(mcpInitializeBody()),
    });

    expect(res.status).toBe(200);
  });
});

describe("API key auth", () => {
  let authServer: Server;
  let authBaseUrl: string;

  beforeAll(async () => {
    const { createTestApp } = await import("./helpers/createTestApp.js");
    const result = await createTestApp({
      mode: "fixture",
      apiKeys: "test-key-1,test-key-2",
    });
    authServer = result.server;
    authBaseUrl = result.baseUrl;
  });

  afterAll(async () => {
    if (authServer) {
      await new Promise<void>((resolve, reject) => {
        authServer.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("returns 401 when API key is required but not provided", async () => {
    const res = await fetch(`${authBaseUrl}/mcp`, {
      method: "POST",
      headers: { ...MCP_HEADERS },
      body: JSON.stringify(mcpInitializeBody()),
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid API key", async () => {
    const res = await fetch(`${authBaseUrl}/mcp`, {
      method: "POST",
      headers: {
        ...MCP_HEADERS,
        Authorization: "Bearer wrong-key",
      },
      body: JSON.stringify(mcpInitializeBody()),
    });

    expect(res.status).toBe(401);
  });

  it("allows request with valid API key", async () => {
    const res = await fetch(`${authBaseUrl}/mcp`, {
      method: "POST",
      headers: {
        ...MCP_HEADERS,
        Authorization: "Bearer test-key-1",
      },
      body: JSON.stringify(mcpInitializeBody()),
    });

    expect(res.status).toBe(200);
  });
});

function parseResponse(
  text: string,
  id: number,
): Record<string, unknown> | null {
  const lines = text.split("\n").filter((l) => l.startsWith("data: "));
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line.slice(6)) as Record<string, unknown>;
      if (parsed["id"] === id) return parsed;
    } catch {
      // skip non-JSON SSE lines
    }
  }

  try {
    const direct = JSON.parse(text) as Record<string, unknown>;
    if (direct["id"] === id) return direct;
  } catch {
    // not a direct JSON response
  }

  return null;
}
