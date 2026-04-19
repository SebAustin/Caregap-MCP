import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Request } from "express";
import { registerPingTool } from "./ping.js";
import { registerGetMeasureSpecTool } from "./getMeasureSpec.js";
import { registerIdentifyOpenGapsTool } from "./identifyOpenGaps.js";
import { registerCalculateEligibilityTool } from "./calculateEligibility.js";
import { registerAssessExclusionsTool } from "./assessExclusions.js";
import { registerDraftOutreachTool } from "./draftOutreach.js";
import { registerRankGapsByPriorityTool } from "./rankGapsByPriority.js";
import { registerPanelGapSummaryTool } from "./panelGapSummary.js";

export function registerAllTools(server: McpServer, req: Request): void {
  registerPingTool(server, req);
  registerGetMeasureSpecTool(server);
  registerIdentifyOpenGapsTool(server, req);
  registerCalculateEligibilityTool(server, req);
  registerAssessExclusionsTool(server, req);
  registerDraftOutreachTool(server, req);
  registerRankGapsByPriorityTool(server, req);
  registerPanelGapSummaryTool(server, req);
}
