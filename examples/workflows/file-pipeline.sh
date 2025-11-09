#!/usr/bin/env bash

#
# File Processing Pipeline Workflow Example
#
# Demonstrates cross-file operations:
# 1. Read a JSON configuration file
# 2. Transform it (bump version)
# 3. Write it back
#

set -euo pipefail

MCP="deno run --allow-all src/cli.ts"

# Configuration
CONFIG_FILE="${1:-package.json}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: File not found: $CONFIG_FILE"
  echo "Usage: $0 [config-file.json]"
  exit 1
fi

echo "========================================"
echo "File Processing Pipeline"
echo "========================================"
echo ""
echo "Target: $CONFIG_FILE"
echo ""

# Step 1: Read the configuration file
echo "[1/3] Reading configuration file..."

READ_RESULT=$($MCP tools exec filesystem read_file \
  --args '{"path":"'"$CONFIG_FILE"'"}' 2>&1)

if ! echo "$READ_RESULT" | jq -e '.success' >/dev/null 2>&1; then
  echo "❌ Failed to read file"
  echo "Error: $(echo "$READ_RESULT" | jq -r '.error.message')"
  exit 1
fi

CONTENT=$(echo "$READ_RESULT" | jq -r '.data.content[0].text')
echo "✅ File read successfully"

# Step 2: Transform the data (bump version)
echo ""
echo "[2/3] Transforming configuration..."

CURRENT_VERSION=$(echo "$CONTENT" | jq -r '.version // "0.0.0"')
echo "Current version: $CURRENT_VERSION"

# Bump patch version
NEW_VERSION=$(echo "$CURRENT_VERSION" | awk -F. '{$NF++;print}' OFS=.)
echo "New version: $NEW_VERSION"

# Create updated config
UPDATED_CONFIG=$(echo "$CONTENT" | jq --arg ver "$NEW_VERSION" '.version = $ver')
echo "✅ Configuration updated"

# Step 3: Write the updated config back (with backup)
echo ""
echo "[3/3] Writing updated configuration..."

# Create backup first
BACKUP_FILE="${CONFIG_FILE}.backup"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "Created backup: $BACKUP_FILE"

# Write updated config
WRITE_RESULT=$($MCP tools exec filesystem write_file \
  --args "{\"path\":\"$CONFIG_FILE\",\"content\":$(echo "$UPDATED_CONFIG" | jq -R -s '.')}" 2>&1)

if ! echo "$WRITE_RESULT" | jq -e '.success' >/dev/null 2>&1; then
  echo "❌ Failed to write file"
  echo "Error: $(echo "$WRITE_RESULT" | jq -r '.error.message')"
  echo ""
  echo "Restoring from backup..."
  mv "$BACKUP_FILE" "$CONFIG_FILE"
  exit 1
fi

echo "✅ Configuration written successfully"

# Display summary
echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo ""
echo "  File: $CONFIG_FILE"
echo "  Version: $CURRENT_VERSION → $NEW_VERSION"
echo "  Backup: $BACKUP_FILE"
echo ""

# Show the changes
echo "Changes:"
echo ""
echo "Before:"
echo "$CONTENT" | jq '{version}'
echo ""
echo "After:"
echo "$UPDATED_CONFIG" | jq '{version}'

echo ""
echo "========================================"
echo "Pipeline Complete"
echo "========================================"
