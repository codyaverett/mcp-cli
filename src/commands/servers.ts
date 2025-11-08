/**
 * Server management commands
 */

import { addServer, removeServer, listServers, getConfigPath } from '../config/loader.js';
import type { ServerConfig } from '../types/config.js';
import { formatSuccess, formatError } from '../utils/json.js';
import { logger } from '../utils/logger.js';
import { createMCPClient } from '../client/factory.js';

/**
 * List all configured servers
 */
export async function listServersCommand(): Promise<string> {
  try {
    const servers = await listServers();

    const serverList = Object.entries(servers).map(([name, config]) => ({
      name,
      type: config.type,
      ...(config.type === 'stdio' && {
        command: config.command,
        args: config.args,
      }),
      ...(config.type === 'sse' && {
        url: config.url,
      }),
      ...(config.type === 'http' && {
        url: config.url,
      }),
    }));

    return formatSuccess({
      servers: serverList,
      count: serverList.length,
      configPath: getConfigPath(),
    });
  } catch (error) {
    logger.error('Failed to list servers', { error });
    return formatError(error as Error);
  }
}

/**
 * Add a new server to the configuration
 */
export async function addServerCommand(
  name: string,
  config: ServerConfig
): Promise<string> {
  try {
    await addServer(name, config);

    return formatSuccess({
      message: `Server "${name}" added successfully`,
      server: { name, ...config },
    });
  } catch (error) {
    logger.error('Failed to add server', { error, name, config });
    return formatError(error as Error);
  }
}

/**
 * Remove a server from the configuration
 */
export async function removeServerCommand(name: string): Promise<string> {
  try {
    await removeServer(name);

    return formatSuccess({
      message: `Server "${name}" removed successfully`,
    });
  } catch (error) {
    logger.error('Failed to remove server', { error, name });
    return formatError(error as Error);
  }
}

/**
 * Test a server connection
 */
export async function testServerCommand(name: string): Promise<string> {
  const startTime = Date.now();

  try {
    const servers = await listServers();
    const config = servers[name];

    if (!config) {
      throw new Error(`Server "${name}" not found in configuration`);
    }

    logger.info(`Testing connection to server "${name}"...`);

    const client = createMCPClient(config);
    await client.connect();

    // Try to list tools to verify the connection works
    const tools = await client.listTools();

    await client.disconnect();

    const executionTime = Date.now() - startTime;

    return formatSuccess(
      {
        message: `Successfully connected to server "${name}"`,
        server: name,
        toolsAvailable: tools.length,
        connectionType: config.type,
      },
      {
        server: name,
        executionTime,
      }
    );
  } catch (error) {
    logger.error('Failed to test server connection', { error, name });
    const executionTime = Date.now() - startTime;

    return formatError(
      error as Error,
      undefined,
      {
        server: name,
        executionTime,
      }
    );
  }
}
