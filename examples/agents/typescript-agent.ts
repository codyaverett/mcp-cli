#!/usr/bin/env -S deno run --allow-all

/**
 * TypeScript Agent Example
 *
 * Demonstrates a production-ready agent that integrates with MCP CLI
 * using progressive disclosure and intelligent tool discovery.
 */

interface MCPResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    suggestion?: string;
  };
  metadata?: {
    server?: string;
    timestamp?: string;
    executionTime?: number;
    tokensEstimate?: number;
  };
}

interface DiscoveryResult {
  servers: Array<{
    name: string;
    tools: number;
    resources?: number;
    prompts?: number;
    enabled: boolean;
  }>;
  matches?: Array<{
    server: string;
    tool: string;
    description?: string;
    confidence: number;
  }>;
  suggested_batch?: {
    server: string;
    operations: string[];
  } | null;
}

interface ToolSchema {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

class MCPAgent {
  private mcpCommand = "deno run --allow-all src/cli.ts";

  /**
   * Execute an MCP CLI command
   */
  private async execMCP(command: string): Promise<MCPResponse> {
    console.error(`[MCP] Running: ${this.mcpCommand} ${command}`);

    const process = new Deno.Command("sh", {
      args: ["-c", `${this.mcpCommand} ${command}`],
      stdout: "piped",
      stderr: "piped",
    });

    const output = await process.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    if (stderr) {
      console.error(`[MCP] stderr: ${stderr}`);
    }

    try {
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(`Failed to parse MCP response: ${stdout}`);
    }
  }

  /**
   * Phase 1: Discover relevant tools for a task
   */
  async discover(task: string): Promise<DiscoveryResult> {
    console.error(`\n[DISCOVER] Finding tools for: "${task}"`);

    const response = await this.execMCP(`discover "${task}"`);

    if (!response.success) {
      throw new Error(
        `Discovery failed: ${response.error?.message || "Unknown error"}`,
      );
    }

    const result = response.data as DiscoveryResult;

    console.error(
      `[DISCOVER] Found ${result.matches?.length || 0} matching tools`,
    );

    if (result.suggested_batch) {
      console.error(
        `[DISCOVER] Suggested batch: ${result.suggested_batch.server} (${result.suggested_batch.operations.length} operations)`,
      );
    }

    console.error(
      `[DISCOVER] Tokens used: ~${response.metadata?.tokensEstimate || "unknown"}`,
    );

    return result;
  }

  /**
   * Phase 2: Load schemas for specific tools (just-in-time)
   */
  async loadSchemas(
    server: string,
    tools: string[],
  ): Promise<ToolSchema[]> {
    console.error(
      `\n[SCHEMA] Loading schemas for ${tools.length} tools from ${server}`,
    );

    const toolList = tools.join(" ");
    const response = await this.execMCP(
      `tools schema ${server} ${toolList}`,
    );

    if (!response.success) {
      throw new Error(
        `Schema loading failed: ${response.error?.message || "Unknown error"}`,
      );
    }

    const schemas = Array.isArray(response.data)
      ? (response.data as ToolSchema[])
      : [response.data as ToolSchema];

    console.error(
      `[SCHEMA] Loaded ${schemas.length} schemas (~${
        response.metadata?.tokensEstimate || "unknown"
      } tokens)`,
    );

    return schemas;
  }

  /**
   * Phase 3: Execute a single tool
   */
  async exec(
    server: string,
    tool: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    console.error(`\n[EXEC] Executing ${server}:${tool}`);

    const argsJson = JSON.stringify(args).replace(/"/g, '\\"');
    const response = await this.execMCP(
      `tools exec ${server} ${tool} --args "${argsJson}"`,
    );

    if (!response.success) {
      throw new Error(
        `Execution failed: ${response.error?.message || "Unknown error"}`,
      );
    }

    console.error(
      `[EXEC] Success (${response.metadata?.executionTime || "unknown"}ms)`,
    );

    return response.data;
  }

  /**
   * Phase 3: Execute multiple tools in batch (maintains connection state)
   */
  async batch(
    server: string,
    operations: Array<{ tool: string; args: Record<string, unknown> }>,
    transactional = false,
  ): Promise<unknown> {
    console.error(
      `\n[BATCH] Executing ${operations.length} operations on ${server}`,
    );

    const opsJson = JSON.stringify(operations).replace(/"/g, '\\"');
    const txFlag = transactional ? "--transactional" : "";

    const response = await this.execMCP(
      `tools batch ${server} ${txFlag} --operations "${opsJson}"`,
    );

    if (!response.success) {
      throw new Error(
        `Batch execution failed: ${response.error?.message || "Unknown error"}`,
      );
    }

    console.error(
      `[BATCH] Success (${response.metadata?.executionTime || "unknown"}ms)`,
    );

    return response.data;
  }

  /**
   * High-level task execution with full workflow
   */
  async executeTask(task: string): Promise<unknown> {
    console.error(`\n${"=".repeat(60)}`);
    console.error(`TASK: ${task}`);
    console.error(`${"=".repeat(60)}`);

    // Phase 1: Discovery
    const discovery = await this.discover(task);

    if (!discovery.matches || discovery.matches.length === 0) {
      throw new Error("No matching tools found for the task");
    }

    // Phase 2: Decide on execution strategy
    if (discovery.suggested_batch) {
      // Use batch execution for related operations
      const { server, operations } = discovery.suggested_batch;

      console.error(
        `\n[STRATEGY] Using batch execution (${operations.length} operations)`,
      );

      // Load schemas for all batch operations
      const schemas = await this.loadSchemas(server, operations);

      // Build batch operations with inferred arguments
      const batchOps = operations.map((toolName) => {
        const schema = schemas.find((s) => s.name === toolName);
        const args = this.inferArguments(toolName, schema, task);
        return { tool: toolName, args };
      });

      // Execute batch
      return await this.batch(server, batchOps);
    } else {
      // Use single tool execution
      const topMatch = discovery.matches[0];

      console.error(
        `\n[STRATEGY] Using single tool execution (confidence: ${topMatch.confidence})`,
      );

      // Load schema for the tool
      const schemas = await this.loadSchemas(topMatch.server, [
        topMatch.tool,
      ]);

      // Infer arguments
      const args = this.inferArguments(topMatch.tool, schemas[0], task);

      // Execute
      return await this.exec(topMatch.server, topMatch.tool, args);
    }
  }

  /**
   * Infer arguments for a tool based on schema and task description
   * (In a real agent, this would use LLM reasoning)
   */
  private inferArguments(
    toolName: string,
    schema: ToolSchema | undefined,
    task: string,
  ): Record<string, unknown> {
    console.error(
      `[INFER] Inferring arguments for ${toolName} (simplified logic)`,
    );

    // Simplified argument inference (in production, use LLM)
    const args: Record<string, unknown> = {};

    if (toolName === "browser_navigate") {
      // Extract URL from task or use default
      const urlMatch = task.match(/https?:\/\/[^\s]+/);
      args.url = urlMatch ? urlMatch[0] : "https://example.com";
    } else if (toolName === "browser_screenshot") {
      args.filename = "screenshot.png";
      args.fullPage = true;
    } else if (toolName === "read_file") {
      // Extract file path from task
      const pathMatch = task.match(/["']([^"']+)["']/);
      args.path = pathMatch ? pathMatch[1] : "README.md";
    }

    console.error(`[INFER] Arguments: ${JSON.stringify(args)}`);

    return args;
  }
}

// Main execution
if (import.meta.main) {
  const task = Deno.args[0];

  if (!task) {
    console.error("Usage: typescript-agent.ts <task-description>");
    console.error("");
    console.error("Examples:");
    console.error('  typescript-agent.ts "navigate to google.com and take a screenshot"');
    console.error('  typescript-agent.ts "read the README.md file"');
    Deno.exit(1);
  }

  try {
    const agent = new MCPAgent();
    const result = await agent.executeTask(task);

    console.log("\n=== RESULT ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n=== ERROR ===");
    console.error(error.message);
    Deno.exit(1);
  }
}

export { MCPAgent };
