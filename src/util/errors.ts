export class McpToolError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "McpToolError";
    this.statusCode = statusCode;
  }

  toToolResult() {
    return {
      content: [{ type: "text" as const, text: this.message }],
      isError: true,
    };
  }
}
