import { configLoader } from "../config/loader.ts";
import { clientPool } from "../client/factory.ts";
import { JSONFormatter } from "../utils/json.ts";
import { logger } from "../utils/logger.ts";
import { Errors } from "../utils/errors.ts";
import type { SearchResult } from "../types/commands.ts";
import type { BriefTool } from "../types/mcp.ts";

interface DiscoveryMatch {
  server: string;
  tool: string;
  description?: string;
  confidence: number;
}

interface ServerCapabilities {
  name: string;
  tools: number;
  resources?: number;
  prompts?: number;
  enabled: boolean;
}

interface DiscoveryResult {
  servers: ServerCapabilities[];
  matches?: DiscoveryMatch[];
  suggested_batch?: {
    server: string;
    operations: string[];
  } | null;
}

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

/**
 * Unified discovery command - combines server listing with intelligent search
 */
export async function discoverCapabilities(query?: string): Promise<void> {
  const startTime = Date.now();

  try {
    if (query) {
      logger.info("Discovering capabilities for task", { query });
    } else {
      logger.info("Discovering available servers");
    }

    const config = await configLoader.getConfig();
    const serverNames = Object.keys(config.servers);

    const serverCapabilities: ServerCapabilities[] = [];

    // Get capabilities for all servers
    await Promise.all(
      serverNames.map(async (serverName) => {
        try {
          const serverConfig = config.servers[serverName];
          const enabled = serverConfig.enabled !== false;

          // Only connect to enabled servers
          if (enabled) {
            try {
              const client = await clientPool.getClient(serverName);

              // Count capabilities
              const tools = await client.listTools();
              let resourceCount: number | undefined;
              let promptCount: number | undefined;

              // Try to get resource and prompt counts (may not be supported)
              try {
                const resources = await client.listResources();
                resourceCount = resources.length;
              } catch {
                // Server doesn't support resources
              }

              try {
                const prompts = await client.listPrompts();
                promptCount = prompts.length;
              } catch {
                // Server doesn't support prompts
              }

              serverCapabilities.push({
                name: serverName,
                tools: tools.length,
                resources: resourceCount,
                prompts: promptCount,
                enabled,
              });
            } catch (error) {
              logger.warn(`Failed to connect to server: ${serverName}`, { error });
              // Add server but with 0 capabilities
              serverCapabilities.push({
                name: serverName,
                tools: 0,
                enabled: false,
              });
            }
          } else {
            // Server is disabled
            serverCapabilities.push({
              name: serverName,
              tools: 0,
              enabled: false,
            });
          }
        } catch (error) {
          logger.warn(`Error processing server: ${serverName}`, { error });
        }
      }),
    );

    // If no query, just return server list
    if (!query) {
      const result: DiscoveryResult = {
        servers: serverCapabilities,
      };

      const response = JSONFormatter.withMetadata(
        result,
        undefined,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
      return;
    }

    // With query: perform intelligent search and recommendations
    const recommendations: DiscoveryMatch[] = [];
    const queryLower = query.toLowerCase();

    await Promise.all(
      serverNames.map(async (serverName) => {
        try {
          const serverConfig = config.servers[serverName];
          if (serverConfig.enabled === false) return;

          const client = await clientPool.getClient(serverName);
          const tools = await client.listTools();

          // Score each tool based on relevance
          for (const tool of tools) {
            let score = 0;

            // Check name matches
            const nameLower = tool.name.toLowerCase();
            const nameWords = nameLower.split(/[_-]/);

            for (const word of nameWords) {
              if (queryLower.includes(word) && word.length > 2) {
                score += 2;
              }
            }

            // Check description matches
            if (tool.description) {
              const descLower = tool.description.toLowerCase();
              const descWords = descLower.split(/\s+/);

              for (const word of descWords) {
                if (queryLower.includes(word) && word.length > 3) {
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
        }
      }),
    );

    // Sort by confidence and take top 10
    recommendations.sort((a, b) => b.confidence - a.confidence);
    const topRecommendations = recommendations.slice(0, 10);

    // Suggest batching if multiple tools from same server have high confidence
    let suggestedBatch: { server: string; operations: string[] } | null = null;

    if (topRecommendations.length >= 2) {
      // Group recommendations by server
      const byServer: Record<string, DiscoveryMatch[]> = {};
      for (const rec of topRecommendations.slice(0, 5)) { // Check top 5
        if (rec.confidence >= 0.5) { // Only high-confidence recommendations
          if (!byServer[rec.server]) {
            byServer[rec.server] = [];
          }
          byServer[rec.server].push(rec);
        }
      }

      // Find server with most high-confidence matches
      let maxServer = "";
      let maxCount = 0;

      for (const [serverName, matches] of Object.entries(byServer)) {
        if (matches.length > maxCount && matches.length >= 2) {
          maxCount = matches.length;
          maxServer = serverName;
        }
      }

      // Suggest batch if we found a good candidate
      if (maxServer && maxCount >= 2) {
        suggestedBatch = {
          server: maxServer,
          operations: byServer[maxServer].map((m) => m.tool),
        };
      }
    }

    // Filter servers to only those with matches
    const relevantServers = serverCapabilities.filter((s) =>
      topRecommendations.some((r) => r.server === s.name)
    );

    const result: DiscoveryResult = {
      servers: relevantServers.length > 0 ? relevantServers : serverCapabilities,
      matches: topRecommendations,
      suggested_batch: suggestedBatch,
    };

    const response = JSONFormatter.withMetadata(
      result,
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
