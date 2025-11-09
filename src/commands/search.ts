import { configLoader } from "../config/loader.ts";
import { clientPool } from "../client/factory.ts";
import { JSONFormatter } from "../utils/json.ts";
import { logger } from "../utils/logger.ts";
import { Errors } from "../utils/errors.ts";
import type { SearchResult } from "../types/commands.ts";
import type { BriefTool } from "../types/mcp.ts";

/**
 * Search for tools across all servers
 */
export async function searchAllServers(query: string, limit?: number): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info("Searching across all servers", { query });

    const config = await configLoader.getConfig();
    const serverNames = Object.keys(config.servers).filter(
      (name) => config.servers[name].enabled !== false,
    );

    const results: SearchResult = {};
    const queryLower = query.toLowerCase();

    // Search each server
    await Promise.all(
      serverNames.map(async (serverName) => {
        try {
          const client = await clientPool.getClient(serverName);
          const tools = await client.listTools();

          // Find matching tools
          const matches = tools.filter(
            (tool) =>
              tool.name.toLowerCase().includes(queryLower) ||
              (tool.description && tool.description.toLowerCase().includes(queryLower)),
          );

          if (matches.length > 0) {
            results[serverName] = matches.map((t) => t.name);
          }
        } catch (error) {
          logger.warn(`Failed to search server: ${serverName}`, { error });
          // Continue with other servers
        }
      }),
    );

    // Apply limit if specified
    if (limit) {
      const limitedResults: SearchResult = {};
      let count = 0;

      for (const [serverName, toolNames] of Object.entries(results)) {
        if (count >= limit) break;

        const remaining = limit - count;
        limitedResults[serverName] = toolNames.slice(0, remaining);
        count += limitedResults[serverName].length;
      }

      const response = JSONFormatter.withMetadata(
        limitedResults,
        undefined,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
    } else {
      const response = JSONFormatter.withMetadata(
        results,
        undefined,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
    }
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}

/**
 * Get recommendations for a task description
 */
export async function recommendTools(taskDescription: string): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info("Getting tool recommendations", { task: taskDescription });

    const config = await configLoader.getConfig();
    const serverNames = Object.keys(config.servers).filter(
      (name) => config.servers[name].enabled !== false,
    );

    const recommendations: Array<{
      server: string;
      tool: string;
      description?: string;
      confidence: number;
    }> = [];

    const taskLower = taskDescription.toLowerCase();

    // Analyze each server
    await Promise.all(
      serverNames.map(async (serverName) => {
        try {
          const client = await clientPool.getClient(serverName);
          const tools = await client.listTools();

          // Score each tool based on relevance
          for (const tool of tools) {
            let score = 0;

            // Check name matches
            const nameLower = tool.name.toLowerCase();
            const nameWords = nameLower.split(/[_-]/);

            for (const word of nameWords) {
              if (taskLower.includes(word) && word.length > 2) {
                score += 2;
              }
            }

            // Check description matches
            if (tool.description) {
              const descLower = tool.description.toLowerCase();
              const descWords = descLower.split(/\s+/);

              for (const word of descWords) {
                if (taskLower.includes(word) && word.length > 3) {
                  score += 1;
                }
              }
            }

            // Add to recommendations if score is above threshold
            if (score > 0) {
              recommendations.push({
                server: serverName,
                tool: tool.name,
                description: tool.description,
                confidence: Math.min(score / 10, 1.0), // Normalize to 0-1
              });
            }
          }
        } catch (error) {
          logger.warn(`Failed to analyze server: ${serverName}`, { error });
          // Continue with other servers
        }
      }),
    );

    // Sort by confidence and return top matches
    recommendations.sort((a, b) => b.confidence - a.confidence);
    const topRecommendations = recommendations.slice(0, 10);

    const response = JSONFormatter.withMetadata(
      { tools: topRecommendations },
      undefined,
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
 * Search tools with detailed results (brief descriptions)
 */
export async function searchToolsDetailed(query: string, limit?: number): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info("Detailed search across all servers", { query });

    const config = await configLoader.getConfig();
    const serverNames = Object.keys(config.servers).filter(
      (name) => config.servers[name].enabled !== false,
    );

    const results: Record<string, BriefTool[]> = {};
    const queryLower = query.toLowerCase();

    // Search each server
    await Promise.all(
      serverNames.map(async (serverName) => {
        try {
          const client = await clientPool.getClient(serverName);
          const tools = await client.listTools();

          // Find matching tools
          const matches = tools.filter(
            (tool) =>
              tool.name.toLowerCase().includes(queryLower) ||
              (tool.description && tool.description.toLowerCase().includes(queryLower)),
          );

          if (matches.length > 0) {
            results[serverName] = matches.map((t) => ({
              name: t.name,
              description: t.description,
            }));
          }
        } catch (error) {
          logger.warn(`Failed to search server: ${serverName}`, { error });
          // Continue with other servers
        }
      }),
    );

    // Apply limit if specified
    if (limit) {
      const limitedResults: Record<string, BriefTool[]> = {};
      let count = 0;

      for (const [serverName, tools] of Object.entries(results)) {
        if (count >= limit) break;

        const remaining = limit - count;
        limitedResults[serverName] = tools.slice(0, remaining);
        count += limitedResults[serverName].length;
      }

      const response = JSONFormatter.withMetadata(
        limitedResults,
        undefined,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
    } else {
      const response = JSONFormatter.withMetadata(
        results,
        undefined,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
    }
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}
