import { clientPool } from "../client/factory.ts";
import { configLoader } from "../config/loader.ts";
import { JSONFormatter } from "../utils/json.ts";
import { logger } from "../utils/logger.ts";
import { Errors } from "../utils/errors.ts";
import type { BriefTool } from "../types/mcp.ts";
import type { BatchExecOptions, ToolExecOptions, ToolListOptions } from "../types/commands.ts";

/**
 * Helper to show available servers when server argument is missing
 */
async function showAvailableServers(): Promise<void> {
  const config = await configLoader.getConfig();
  const servers = Object.keys(config.servers);

  if (servers.length === 0) {
    const error = Errors.validationError(
      "No server specified",
    );
    error.suggestion =
      "No servers configured. Run 'mcp servers init' then 'mcp servers add <name> --type stdio --command <cmd>' to add your first server";
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
  }

  const error = Errors.validationError(
    "No server specified",
  );
  error.suggestion = `Available servers: ${servers.join(", ")}`;
  JSONFormatter.output(error.toJSON());
  Deno.exit(1);
}

/**
 * List tools from a server with progressive disclosure support
 */
export async function listTools(
  serverName: string | undefined,
  options: ToolListOptions,
): Promise<void> {
  if (!serverName) {
    await showAvailableServers();
    return;
  }

  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(serverName);
    const tools = await client.listTools();

    // Names only mode (minimal context - default)
    if (options.namesOnly || (!options.brief && !options.full)) {
      const names = tools.map((t) => t.name);

      const response = JSONFormatter.withMetadata(
        names,
        serverName,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
      return;
    }

    // Brief mode (moderate context)
    if (options.brief) {
      const brief: BriefTool[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
      }));

      const response = JSONFormatter.withMetadata(
        brief,
        serverName,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
      return;
    }

    // Full mode (high context - only when explicitly requested)
    if (options.full) {
      const response = JSONFormatter.withMetadata(
        tools,
        serverName,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
      return;
    }
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}

/**
 * Get schema for specific tool(s) - just-in-time loading
 */
export async function getToolSchema(
  serverName: string | undefined,
  toolNames: string[],
): Promise<void> {
  if (!serverName) {
    await showAvailableServers();
    return;
  }

  if (toolNames.length === 0) {
    const error = Errors.validationError(
      "No tool names specified",
    );
    error.suggestion = `Usage: mcp tools schema ${serverName} <tool-name> [<tool-name>...]`;
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
  }

  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(serverName);

    // Get schemas for all requested tools
    const schemas = await Promise.all(
      toolNames.map(async (name) => {
        const tool = await client.getTool(name);
        if (!tool) {
          throw Errors.toolNotFound(name, serverName);
        }
        return tool;
      }),
    );

    // Return single schema if only one requested, array otherwise
    const data = schemas.length === 1 ? schemas[0] : schemas;

    const response = JSONFormatter.withMetadata(
      data,
      serverName,
      Date.now() - startTime,
    );
    JSONFormatter.output(response);
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}

/**
 * Execute a tool
 */
export async function executeTool(options: ToolExecOptions): Promise<void> {
  if (!options.server) {
    await showAvailableServers();
    return;
  }

  if (!options.tool) {
    const error = Errors.validationError(
      "No tool name specified",
    );
    error.suggestion = `Usage: mcp tools exec ${options.server} <tool-name> --args <json>`;
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
  }

  if (!options.args) {
    const error = Errors.validationError(
      "No arguments specified",
    );
    error.suggestion = `Usage: mcp tools exec ${options.server} ${options.tool} --args <json>`;
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
  }

  const startTime = Date.now();

  try {
    logger.info("Executing tool", {
      server: options.server,
      tool: options.tool,
    });

    const client = await clientPool.getClient(options.server);

    // Validate tool exists
    const tool = await client.getTool(options.tool);
    if (!tool) {
      const allTools = await client.listTools();
      throw Errors.toolNotFound(
        options.tool,
        options.server,
        allTools.map((t) => t.name),
      );
    }

    // Execute the tool
    const result = await client.executeTool(options.tool, options.args);

    // Handle truncation if maxTokens specified
    let data: unknown = result;
    let truncated = false;

    if (options.maxTokens && result.content) {
      const contentString = JSON.stringify(result.content);
      const truncateResult = JSONFormatter.truncateToTokens(contentString, options.maxTokens);
      if (truncateResult.truncated) {
        truncated = true;
        data = {
          ...result,
          content: JSON.parse(truncateResult.text),
        };
      }
    }

    const response = JSONFormatter.success(data, {
      server: options.server,
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime,
      tokensEstimate: JSONFormatter.estimateTokensForObject(data),
      truncated,
    });

    JSONFormatter.output(response);
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}

/**
 * Search for tools across a server
 */
export async function searchTools(serverName: string, query: string): Promise<void> {
  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(serverName);
    const tools = await client.listTools();

    // Simple text search in tool names and descriptions
    const queryLower = query.toLowerCase();
    const matches = tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(queryLower) ||
        (tool.description && tool.description.toLowerCase().includes(queryLower)),
    );

    // Return brief descriptions of matches
    const results: BriefTool[] = matches.map((t) => ({
      name: t.name,
      description: t.description,
    }));

    const response = JSONFormatter.withMetadata(
      results,
      serverName,
      Date.now() - startTime,
    );
    JSONFormatter.output(response);
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}

/**
 * Execute multiple tools in batch (sequentially) without disconnecting
 */
export async function executeBatch(options: BatchExecOptions): Promise<void> {
  if (!options.operations || options.operations.length === 0) {
    const error = Errors.validationError(
      "No operations specified for batch execution",
    );
    error.suggestion = "Provide at least one operation with server, tool, and args";
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
    return;
  }

  // All operations must use the same server for now
  const servers = new Set(options.operations.map((op) => op.server));
  if (servers.size > 1) {
    const error = Errors.validationError(
      "All operations in a batch must use the same server",
    );
    error.suggestion = `Found multiple servers: ${
      Array.from(servers).join(", ")
    }. Use separate batch commands for different servers.`;
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
    return;
  }

  const serverName = options.operations[0].server;
  const startTime = Date.now();

  try {
    logger.info("Executing batch operations", {
      server: serverName,
      operationCount: options.operations.length,
      transactional: options.transactional,
    });

    const client = await clientPool.getClient(serverName);
    const results: Array<{
      tool: string;
      result: unknown;
      executionTime: number;
      outputVar?: string;
    }> = [];

    // Execute all operations sequentially
    for (const operation of options.operations) {
      const opStartTime = Date.now();

      try {
        logger.info("Executing batch operation", {
          tool: operation.tool,
          outputVar: operation.outputVar,
        });

        // Validate tool exists
        const tool = await client.getTool(operation.tool);
        if (!tool) {
          throw Errors.toolNotFound(operation.tool, serverName);
        }

        // Execute the tool
        const result = await client.executeTool(operation.tool, operation.args);

        results.push({
          tool: operation.tool,
          result,
          executionTime: Date.now() - opStartTime,
          outputVar: operation.outputVar,
        });
      } catch (error) {
        // If transactional mode is enabled, fail the entire batch
        if (options.transactional) {
          const mcpError = Errors.wrap(error);
          mcpError.message = `Batch execution failed at operation ${
            results.length + 1
          } (${operation.tool}): ${mcpError.message}`;
          JSONFormatter.output(mcpError.toJSON());
          Deno.exit(1);
          return;
        }

        // Otherwise, record the error and continue
        const mcpError = Errors.wrap(error);
        results.push({
          tool: operation.tool,
          result: {
            error: mcpError.toJSON(),
          },
          executionTime: Date.now() - opStartTime,
          outputVar: operation.outputVar,
        });
      }
    }

    const response = JSONFormatter.success(
      {
        operations: results,
        summary: {
          total: options.operations.length,
          succeeded: results.filter((r) =>
            !(r.result && typeof r.result === "object" && "error" in r.result)
          ).length,
          failed: results.filter((r) =>
            r.result && typeof r.result === "object" && "error" in r.result
          ).length,
        },
      },
      {
        server: serverName,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
      },
    );

    JSONFormatter.output(response);
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}
