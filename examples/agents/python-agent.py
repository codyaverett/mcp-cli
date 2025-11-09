#!/usr/bin/env python3

"""
Python Agent Example

Demonstrates a Python-based agent that integrates with MCP CLI
using subprocess calls and JSON parsing.
"""

import json
import subprocess
import sys
from typing import Any, Dict, List, Optional, Tuple


class MCPAgent:
    """Agent that integrates with MCP CLI using progressive disclosure."""

    def __init__(self, mcp_command: str = "deno run --allow-all src/cli.ts"):
        self.mcp_command = mcp_command

    def _exec_mcp(self, command: str) -> Dict[str, Any]:
        """Execute an MCP CLI command and return parsed JSON response."""
        full_command = f"{self.mcp_command} {command}"
        print(f"[MCP] Running: {full_command}", file=sys.stderr)

        try:
            result = subprocess.run(
                full_command,
                shell=True,
                capture_output=True,
                text=True,
                check=False,
            )

            if result.stderr:
                print(f"[MCP] stderr: {result.stderr}", file=sys.stderr)

            return json.loads(result.stdout)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse MCP response: {result.stdout}") from e
        except Exception as e:
            raise RuntimeError(f"Failed to execute MCP command: {e}") from e

    def discover(self, task: str) -> Dict[str, Any]:
        """Phase 1: Discover relevant tools for a task."""
        print(f'\n[DISCOVER] Finding tools for: "{task}"', file=sys.stderr)

        response = self._exec_mcp(f'discover "{task}"')

        if not response.get("success"):
            error = response.get("error", {})
            raise RuntimeError(
                f"Discovery failed: {error.get('message', 'Unknown error')}"
            )

        result = response.get("data", {})
        matches = result.get("matches", [])

        print(f"[DISCOVER] Found {len(matches)} matching tools", file=sys.stderr)

        if result.get("suggested_batch"):
            batch = result["suggested_batch"]
            print(
                f"[DISCOVER] Suggested batch: {batch['server']} "
                f"({len(batch['operations'])} operations)",
                file=sys.stderr,
            )

        tokens = response.get("metadata", {}).get("tokensEstimate", "unknown")
        print(f"[DISCOVER] Tokens used: ~{tokens}", file=sys.stderr)

        return result

    def load_schemas(self, server: str, tools: List[str]) -> List[Dict[str, Any]]:
        """Phase 2: Load schemas for specific tools (just-in-time)."""
        print(
            f"\n[SCHEMA] Loading schemas for {len(tools)} tools from {server}",
            file=sys.stderr,
        )

        tool_list = " ".join(tools)
        response = self._exec_mcp(f"tools schema {server} {tool_list}")

        if not response.get("success"):
            error = response.get("error", {})
            raise RuntimeError(
                f"Schema loading failed: {error.get('message', 'Unknown error')}"
            )

        data = response.get("data")
        schemas = data if isinstance(data, list) else [data]

        tokens = response.get("metadata", {}).get("tokensEstimate", "unknown")
        print(f"[SCHEMA] Loaded {len(schemas)} schemas (~{tokens} tokens)", file=sys.stderr)

        return schemas

    def exec_tool(
        self, server: str, tool: str, args: Dict[str, Any]
    ) -> Any:
        """Phase 3: Execute a single tool."""
        print(f"\n[EXEC] Executing {server}:{tool}", file=sys.stderr)

        args_json = json.dumps(args).replace('"', '\\"')
        response = self._exec_mcp(f'tools exec {server} {tool} --args "{args_json}"')

        if not response.get("success"):
            error = response.get("error", {})
            raise RuntimeError(
                f"Execution failed: {error.get('message', 'Unknown error')}"
            )

        exec_time = response.get("metadata", {}).get("executionTime", "unknown")
        print(f"[EXEC] Success ({exec_time}ms)", file=sys.stderr)

        return response.get("data")

    def batch(
        self,
        server: str,
        operations: List[Dict[str, Any]],
        transactional: bool = False,
    ) -> Any:
        """Phase 3: Execute multiple tools in batch."""
        print(
            f"\n[BATCH] Executing {len(operations)} operations on {server}",
            file=sys.stderr,
        )

        ops_json = json.dumps(operations).replace('"', '\\"')
        tx_flag = "--transactional" if transactional else ""

        response = self._exec_mcp(
            f'tools batch {server} {tx_flag} --operations "{ops_json}"'
        )

        if not response.get("success"):
            error = response.get("error", {})
            raise RuntimeError(
                f"Batch execution failed: {error.get('message', 'Unknown error')}"
            )

        exec_time = response.get("metadata", {}).get("executionTime", "unknown")
        print(f"[BATCH] Success ({exec_time}ms)", file=sys.stderr)

        return response.get("data")

    def infer_arguments(
        self, tool_name: str, schema: Optional[Dict[str, Any]], task: str
    ) -> Dict[str, Any]:
        """Infer arguments for a tool based on schema and task description."""
        print(
            f"[INFER] Inferring arguments for {tool_name} (simplified logic)",
            file=sys.stderr,
        )

        # Simplified argument inference (in production, use LLM)
        args: Dict[str, Any] = {}

        if tool_name == "browser_navigate":
            # Extract URL from task or use default
            import re
            url_match = re.search(r"https?://[^\s]+", task)
            args["url"] = url_match.group(0) if url_match else "https://example.com"
        elif tool_name == "browser_screenshot":
            args["filename"] = "screenshot.png"
            args["fullPage"] = True
        elif tool_name == "read_file":
            # Extract file path from task
            import re
            path_match = re.search(r'["\']([^"\']+)["\']', task)
            args["path"] = path_match.group(1) if path_match else "README.md"

        print(f"[INFER] Arguments: {json.dumps(args)}", file=sys.stderr)

        return args

    def execute_task(self, task: str) -> Any:
        """High-level task execution with full workflow."""
        print("\n" + "=" * 60, file=sys.stderr)
        print(f"TASK: {task}", file=sys.stderr)
        print("=" * 60, file=sys.stderr)

        # Phase 1: Discovery
        discovery = self.discover(task)

        matches = discovery.get("matches", [])
        if not matches:
            raise RuntimeError("No matching tools found for the task")

        # Phase 2: Decide on execution strategy
        suggested_batch = discovery.get("suggested_batch")

        if suggested_batch:
            # Use batch execution for related operations
            server = suggested_batch["server"]
            operations = suggested_batch["operations"]

            print(
                f"\n[STRATEGY] Using batch execution ({len(operations)} operations)",
                file=sys.stderr,
            )

            # Load schemas for all batch operations
            schemas = self.load_schemas(server, operations)

            # Build batch operations with inferred arguments
            batch_ops = []
            for tool_name in operations:
                schema = next((s for s in schemas if s["name"] == tool_name), None)
                args = self.infer_arguments(tool_name, schema, task)
                batch_ops.append({"tool": tool_name, "args": args})

            # Execute batch
            return self.batch(server, batch_ops)
        else:
            # Use single tool execution
            top_match = matches[0]

            print(
                f"\n[STRATEGY] Using single tool execution "
                f"(confidence: {top_match['confidence']})",
                file=sys.stderr,
            )

            # Load schema for the tool
            schemas = self.load_schemas(top_match["server"], [top_match["tool"]])

            # Infer arguments
            args = self.infer_arguments(top_match["tool"], schemas[0], task)

            # Execute
            return self.exec_tool(top_match["server"], top_match["tool"], args)


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python-agent.py <task-description>", file=sys.stderr)
        print("", file=sys.stderr)
        print("Examples:", file=sys.stderr)
        print('  python-agent.py "navigate to google.com and take a screenshot"', file=sys.stderr)
        print('  python-agent.py "read the README.md file"', file=sys.stderr)
        sys.exit(1)

    task = sys.argv[1]

    try:
        agent = MCPAgent()
        result = agent.execute_task(task)

        print("\n=== RESULT ===")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print("\n=== ERROR ===", file=sys.stderr)
        print(str(e), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
