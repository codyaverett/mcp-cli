/**
 * Resource operation commands
 */

import { getServerConfig } from '../config/loader.js';
import { createMCPClient } from '../client/factory.js';
import { formatSuccess, formatError } from '../utils/json.js';
import { logger } from '../utils/logger.js';
import { ServerNotFoundError } from '../utils/errors.js';

/**
 * List available resources from a server
 */
export async function listResourcesCommand(serverName: string): Promise<string> {
  const startTime = Date.now();

  try {
    const config = await getServerConfig(serverName);
    if (!config) {
      throw new ServerNotFoundError(serverName);
    }

    logger.info(`Listing resources from server "${serverName}"...`);

    const client = createMCPClient(config);
    await client.connect();

    const resources = await client.listResources();

    await client.disconnect();

    const executionTime = Date.now() - startTime;

    return formatSuccess(
      {
        resources,
        count: resources.length,
      },
      {
        server: serverName,
        executionTime,
      }
    );
  } catch (error) {
    logger.error('Failed to list resources', { error, serverName });
    return formatError(error as Error);
  }
}

/**
 * Read a resource by URI
 */
export async function readResourceCommand(
  serverName: string,
  uri: string
): Promise<string> {
  const startTime = Date.now();

  try {
    const config = await getServerConfig(serverName);
    if (!config) {
      throw new ServerNotFoundError(serverName);
    }

    logger.info(`Reading resource "${uri}" from server "${serverName}"...`);

    const client = createMCPClient(config);
    await client.connect();

    const content = await client.readResource(uri);

    await client.disconnect();

    const executionTime = Date.now() - startTime;

    return formatSuccess(
      {
        resource: content,
      },
      {
        server: serverName,
        executionTime,
      }
    );
  } catch (error) {
    logger.error('Failed to read resource', { error, serverName, uri });
    return formatError(error as Error);
  }
}
