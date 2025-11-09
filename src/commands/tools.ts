import { clientPool } from "../client/factory.ts";
import { JSONFormatter } from "../utils/json.ts";
import { logger } from "../utils/logger.ts";
import { Errors } from "../utils/errors.ts";
import type { BriefTool } from "../types/mcp.ts";
import type { ToolExecOptions, ToolListOptions } from "../types/commands.ts";

/**
 * List tools from a server with progressive disclosure support
 */
export async function listTools(serverName: string, options: ToolListOptions): Promise<void> {
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
  serverName: string,
  toolNames: string[],
): Promise<void> {
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
