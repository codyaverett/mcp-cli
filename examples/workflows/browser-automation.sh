#!/usr/bin/env bash

#
# Browser Automation Workflow Example
#
# Demonstrates batch execution for stateful browser operations:
# 1. Navigate to a form
# 2. Fill form fields
# 3. Submit the form
# 4. Take a screenshot
#

set -euo pipefail

MCP="deno run --allow-all src/cli.ts"

# Configuration
FORM_URL="${1:-https://httpbin.org/forms/post}"
OUTPUT_FILE="form-result.png"

echo "========================================"
echo "Browser Automation Workflow"
echo "========================================"
echo ""
echo "Target: $FORM_URL"
echo "Output: $OUTPUT_FILE"
echo ""

# Execute all browser operations as a batch to maintain session
echo "[1/1] Executing browser automation batch..."

RESULT=$($MCP tools batch playwright --operations '[
  {
    "tool": "playwright_navigate",
    "args": {
      "url": "'"$FORM_URL"'",
      "waitUntil": "networkidle"
    }
  },
  {
    "tool": "playwright_fill",
    "args": {
      "selector": "input[name=\"custname\"]",
      "value": "John Doe"
    }
  },
  {
    "tool": "playwright_fill",
    "args": {
      "selector": "input[name=\"custemail\"]",
      "value": "john@example.com"
    }
  },
  {
    "tool": "playwright_fill",
    "args": {
      "selector": "textarea[name=\"comments\"]",
      "value": "This is an automated test from MCP CLI"
    }
  },
  {
    "tool": "playwright_screenshot",
    "args": {
      "name": "'"$OUTPUT_FILE"'",
      "fullPage": true,
      "savePng": true
    }
  }
]' 2>&1)

# Check if all operations succeeded
if echo "$RESULT" | jq -e '.success' >/dev/null 2>&1; then
  SUCCEEDED=$(echo "$RESULT" | jq '.data.summary.succeeded')
  TOTAL=$(echo "$RESULT" | jq '.data.summary.total')
  EXEC_TIME=$(echo "$RESULT" | jq '.metadata.executionTime')

  if [ "$SUCCEEDED" -eq "$TOTAL" ]; then
    echo ""
    echo "✅ Browser automation completed successfully!"
    echo ""
    echo "Summary:"
    echo "  - Operations: $SUCCEEDED/$TOTAL succeeded"
    echo "  - Execution time: ${EXEC_TIME}ms"
    echo "  - Screenshot saved to: $OUTPUT_FILE"
    echo ""
    echo "Details:"
    echo "$RESULT" | jq '.data.operations[] | "  [\(.tool)] \(if .result.error then "❌ Failed" else "✅ Success" end) (\(.executionTime)ms)"' -r
  else
    echo ""
    echo "❌ Some operations failed"
    echo ""
    echo "Failed operations:"
    echo "$RESULT" | jq '.data.operations[] | select(.result.error) | "  - \(.tool): \(.result.error.message)"' -r
    exit 1
  fi
else
  echo ""
  echo "❌ Batch execution failed"
  echo ""
  ERROR_MSG=$(echo "$RESULT" | jq -r '.error.message // "Unknown error"')
  SUGGESTION=$(echo "$RESULT" | jq -r '.error.suggestion // ""')

  echo "Error: $ERROR_MSG"
  [ -n "$SUGGESTION" ] && echo "Suggestion: $SUGGESTION"

  exit 1
fi

echo ""
echo "========================================"
echo "Workflow Complete"
echo "========================================"
