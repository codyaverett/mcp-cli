import { clientPool } from "../client/factory.ts";
import { configLoader } from "../config/loader.ts";
import { JSONFormatter } from "../utils/json.ts";
import { logger } from "../utils/logger.ts";
import { Errors } from "../utils/errors.ts";
import type { ListOptions, ResourceReadOptions } from "../types/commands.ts";

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
    error.suggestion = "No servers configured. Run 'mcp servers init' then 'mcp servers add <name> --type stdio --command <cmd>' to add your first server";
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
 * List resources from a server
 */
export async function listResources(serverName: string | undefined, options: ListOptions): Promise<void> {
  if (!serverName) {
    await showAvailableServers();
    return;
  }

  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(serverName);
    const resources = await client.listResources();

    // Names/URIs only mode (minimal context)
    if (options.namesOnly) {
      const uris = resources.map((r) => r.uri);

      const response = JSONFormatter.withMetadata(
        uris,
        serverName,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
      return;
    }

    // Full mode with all metadata
    const response = JSONFormatter.withMetadata(
      resources,
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
 * Read a specific resource
 */
export async function readResource(options: ResourceReadOptions): Promise<void> {
  if (!options.server) {
    await showAvailableServers();
    return;
  }

  if (!options.uri) {
    const error = Errors.validationError(
      "No resource URI specified",
    );
    error.suggestion = `Usage: mcp resources read ${options.server} <uri>`;
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
  }

  const startTime = Date.now();

  try {
    logger.info("Reading resource", {
      server: options.server,
      uri: options.uri,
    });

    const client = await clientPool.getClient(options.server);
    const contents = await client.readResource(options.uri);

    // Handle truncation if maxTokens specified
    let data: unknown = contents;
    let truncated = false;

    if (options.maxTokens) {
      const contentString = JSON.stringify(contents.contents);
      const truncateResult = JSONFormatter.truncateToTokens(contentString, options.maxTokens);
      if (truncateResult.truncated) {
        truncated = true;
        data = {
          ...contents,
          contents: JSON.parse(truncateResult.text),
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
 * Search resources by pattern
 */
export async function searchResources(serverName: string, pattern: string): Promise<void> {
  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(serverName);
    const resources = await client.listResources();

    // Simple pattern matching on URI and name
    const patternLower = pattern.toLowerCase();
    const matches = resources.filter(
      (resource) =>
        resource.uri.toLowerCase().includes(patternLower) ||
        resource.name.toLowerCase().includes(patternLower) ||
        (resource.description && resource.description.toLowerCase().includes(patternLower)),
    );

    const response = JSONFormatter.withMetadata(
      matches,
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
 * Get schema/template for a resource
 */
export async function getResourceSchema(serverName: string, uri: string): Promise<void> {
  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(serverName);
    const resources = await client.listResources();

    const resource = resources.find((r) => r.uri === uri);
    if (!resource) {
      throw Errors.resourceNotFound(uri, serverName);
    }

    const response = JSONFormatter.withMetadata(
      resource,
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
