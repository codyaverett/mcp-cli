/**
 * Tool operation commands
 */

import { getServerConfig } from '../config/loader.js';
import { createMCPClient } from '../client/factory.js';
import { formatSuccess, formatError, parseJsonInput } from '../utils/json.js';
import { logger } from '../utils/logger.js';
import { ServerNotFoundError } from '../utils/errors.js';

/**
 * List available tools from a server
 */
export async function listToolsCommand(serverName: string): Promise<string> {
  const startTime = Date.now();

  try {
    const config = await getServerConfig(serverName);
    if (!config) {
      throw new ServerNotFoundError(serverName);
    }

    logger.info(`Listing tools from server "${serverName}"...`);

    const client = createMCPClient(config);
    await client.connect();

    const tools = await client.listTools();

    await client.disconnect();

    const executionTime = Date.now() - startTime;

    return formatSuccess(
      {
        tools,
        count: tools.length,
      },
      {
        server: serverName,
        executionTime,
      }
    );
  } catch (error) {
    logger.error('Failed to list tools', { error, serverName });
    return formatError(error as Error);
  }
}

/**
 * Get the schema for a specific tool
 */
export async function getToolSchemaCommand(
  serverName: string,
  toolName: string
): Promise<string> {
  const startTime = Date.now();

  try {
    const config = await getServerConfig(serverName);
    if (!config) {
      throw new ServerNotFoundError(serverName);
    }

    logger.info(`Getting schema for tool "${toolName}" from server "${serverName}"...`);

    const client = createMCPClient(config);
    await client.connect();

    const tools = await client.listTools();
    const tool = tools.find((t) => t.name === toolName);

    await client.disconnect();

    if (!tool) {
      throw new Error(`Tool "${toolName}" not found on server "${serverName}"`);
    }

    const executionTime = Date.now() - startTime;

    return formatSuccess(
      {
        tool,
      },
      {
        server: serverName,
        executionTime,
      }
    );
  } catch (error) {
    logger.error('Failed to get tool schema', { error, serverName, toolName });
    return formatError(error as Error);
  }
}

/**
 * Execute a tool with arguments
 */
export async function executeToolCommand(
  serverName: string,
  toolName: string,
  argsJson: string
): Promise<string> {
  const startTime = Date.now();

  try {
    const config = await getServerConfig(serverName);
    if (!config) {
      throw new ServerNotFoundError(serverName);
    }

    // Parse arguments
    const args = parseJsonInput(argsJson);

    logger.info(`Executing tool "${toolName}" on server "${serverName}"...`);

    const client = createMCPClient(config);
    await client.connect();

    const result = await client.executeTool(toolName, args);

    await client.disconnect();

    const executionTime = Date.now() - startTime;

    return formatSuccess(
      {
        tool: toolName,
        result,
      },
      {
        server: serverName,
        executionTime,
      }
    );
  } catch (error) {
    logger.error('Failed to execute tool', { error, serverName, toolName });
    return formatError(error as Error);
  }
}
