#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
# CareGap MCP — Terminal Demo Script
# Run this while screen-recording for the video submission.
#
# Usage:
#   1. Start the server:  npm run dev
#   2. In another terminal: bash scripts/demo-curl.sh
#
# The script pauses between scenes so you can narrate.
# Press ENTER to advance to the next scene.
# ────────────────────────────────────────────────────────────────

set -euo pipefail

URL="http://localhost:3333/mcp"
H="Content-Type: application/json"
A="Accept: application/json, text/event-stream"

call_tool() {
  local id=$1 name=$2 args=$3
  curl -s -X POST "$URL" -H "$H" -H "$A" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$id,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}" \
    | sed -n 's/^data: //p' | python3 -m json.tool 2>/dev/null \
    || curl -s -X POST "$URL" -H "$H" -H "$A" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$id,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}"
}

pause() {
  echo ""
  echo "────────────────────────────────────────"
  echo "  Press ENTER for next scene..."
  echo "────────────────────────────────────────"
  read -r
  clear
}

# ── PRE-CHECK ──
echo "Checking server..."
HEALTH=$(curl -s http://localhost:3333/health 2>/dev/null || echo '{"status":"DOWN"}')
if echo "$HEALTH" | grep -q '"ok"'; then
  echo "Server is running: $HEALTH"
else
  echo "ERROR: Server not running on port 3333."
  echo "Start it first:  npm run dev"
  exit 1
fi

pause

# ── SCENE 1: THE PROBLEM ──
cat << 'INTRO'
╔═══════════════════════════════════════════════════════════════╗
║                     CareGap MCP                              ║
║   AI-powered quality measure gap identification & closure    ║
╚═══════════════════════════════════════════════════════════════╝

THE PROBLEM:
  Quality measures (HEDIS, MIPS, CMS Stars) drive billions
  in value-based payments.

  Traditional rule engines miss 30-40% of closable gaps —
  exclusions buried in clinical notes, outside screenings,
  patient refusals in free text.

  CareGap MCP fixes this with AI + MCP + FHIR.
INTRO

pause

# ── SCENE 2: TOOLS LIST ──
echo "╔═══════════════════════════════════════════╗"
echo "║   8 MCP Tools — Full Gap Closure Workflow ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

curl -s -X POST "$URL" -H "$H" -H "$A" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | sed -n 's/^data: //p' \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for t in data['result']['tools']:
    print(f\"  {t['name']:40s} {t.get('description','')[:70]}...\")
" 2>/dev/null || echo "(tools listed above)"

pause

# ── SCENE 3: MEASURE SPEC ──
echo "╔════════════════════════════════════════════════╗"
echo "║   get_measure_specification — BCS-E            ║"
echo "║   Breast Cancer Screening (HEDIS MY 2024)      ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

call_tool 2 "get_measure_specification" '{"measureId":"BCS-E"}'

pause

# ── SCENE 4: IDENTIFY GAPS ──
echo "╔════════════════════════════════════════════════════════╗"
echo "║   identify_open_measure_gaps — Maria (58F, DM+HTN)    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

call_tool 3 "identify_open_measure_gaps" '{"patientId":"patient-maria-001","asOfDate":"2026-04-01"}'

pause

# ── SCENE 5: AI EXCLUSION ANALYSIS (THE AI FACTOR) ──
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   assess_measure_exclusions — THE AI FACTOR             ║"
echo "║   Can Claude find the mammogram in Maria's clinical note? ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Maria's note says: 'Patient completed mammogram at City Imaging"
echo "Center in November 2024. Results normal (BI-RADS 1).'"
echo ""
echo "A rule engine can't read this. Claude can."
echo ""

call_tool 4 "assess_measure_exclusions" '{"patientId":"patient-maria-001","measureId":"BCS-E"}'

pause

# ── SCENE 5b: JAMES HOSPICE EXCLUSION ──
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   assess_measure_exclusions — James (hospice patient)    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

call_tool 5 "assess_measure_exclusions" '{"patientId":"patient-james-002","measureId":"COL-E"}'

pause

# ── SCENE 6: OUTREACH ──
echo "╔════════════════════════════════════════════════════════╗"
echo "║   draft_patient_outreach — Spanish SMS for Maria       ║"
echo "║   Grade 6 reading level, warm tone                     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

call_tool 6 "draft_patient_outreach" '{"patientId":"patient-maria-001","gapIds":["HBD","CBP"],"channel":"sms","language":"es","readingLevel":"grade6","tone":"warm"}'

pause

# ── SCENE 7: PANEL SUMMARY ──
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   panel_gap_summary — Program Director View               ║"
echo "║   4 patients, 5 measures, sorted by financial impact      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

call_tool 7 "panel_gap_summary" '{"asOfDate":"2026-04-01"}'

pause

# ── CLOSING ──
cat << 'CLOSE'
╔═══════════════════════════════════════════════════════════════╗
║                     CareGap MCP                              ║
║                                                              ║
║   SHARP-on-MCP compliant                                     ║
║   Works with any FHIR R4 server                              ║
║   Ships with synthetic data — zero external setup             ║
║   Open source — Apache 2.0                                    ║
║                                                              ║
║   Because closing care gaps shouldn't require                 ║
║   a rule engine rewrite — just the right AI tools.            ║
╚═══════════════════════════════════════════════════════════════╝
CLOSE
echo ""
echo "Try it: npx @modelcontextprotocol/inspector http://localhost:3333/mcp"
echo ""
