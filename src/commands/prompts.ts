/**
 * Prompt operation commands
 */

import { getServerConfig } from '../config/loader.js';
import { createMCPClient } from '../client/factory.js';
import { formatSuccess, formatError, parseJsonInput } from '../utils/json.js';
import { logger } from '../utils/logger.js';
import { ServerNotFoundError } from '../utils/errors.js';

/**
 * List available prompts from a server
 */
export async function listPromptsCommand(serverName: string): Promise<string> {
  const startTime = Date.now();

  try {
    const config = await getServerConfig(serverName);
    if (!config) {
      throw new ServerNotFoundError(serverName);
    }

    logger.info(`Listing prompts from server "${serverName}"...`);

    const client = createMCPClient(config);
    await client.connect();

    const prompts = await client.listPrompts();

    await client.disconnect();

    const executionTime = Date.now() - startTime;

    return formatSuccess(
      {
        prompts,
        count: prompts.length,
      },
      {
        server: serverName,
        executionTime,
      }
    );
  } catch (error) {
    logger.error('Failed to list prompts', { error, serverName });
    return formatError(error as Error);
  }
}

/**
 * Get a prompt with arguments
 */
export async function getPromptCommand(
  serverName: string,
  promptName: string,
  argsJson: string
): Promise<string> {
  const startTime = Date.now();

  try {
    const config = await getServerConfig(serverName);
    if (!config) {
      throw new ServerNotFoundError(serverName);
    }

    // Parse arguments
    const args = argsJson ? parseJsonInput(argsJson) : {};

    if (typeof args !== 'object' || Array.isArray(args)) {
      throw new Error('Arguments must be a JSON object');
    }

    logger.info(`Getting prompt "${promptName}" from server "${serverName}"...`);

    const client = createMCPClient(config);
    await client.connect();

    const messages = await client.getPrompt(promptName, args as Record<string, string>);

    await client.disconnect();

    const executionTime = Date.now() - startTime;

    return formatSuccess(
      {
        prompt: promptName,
        messages,
      },
      {
        server: serverName,
        executionTime,
      }
    );
  } catch (error) {
    logger.error('Failed to get prompt', { error, serverName, promptName });
    return formatError(error as Error);
  }
}
