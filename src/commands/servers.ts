import { configLoader, ConfigLoader } from "../config/loader.ts";
import { ConfigValidator } from "../config/validator.ts";
import { clientPool } from "../client/factory.ts";
import { JSONFormatter } from "../utils/json.ts";
import { logger } from "../utils/logger.ts";
import { Errors } from "../utils/errors.ts";
import { Platform } from "../utils/platform.ts";
import type { ServerConfig, ServerStatus } from "../types/config.ts";
import type { ServerAddOptions, ServerListOptions, ServerInitOptions } from "../types/commands.ts";

/**
 * List all configured servers
 */
export async function listServers(options: ServerListOptions): Promise<void> {
  const startTime = Date.now();

  try {
    const config = await configLoader.getConfig();
    const serverNames = Object.keys(config.servers);

    // Names only mode (minimal context)
    if (options.namesOnly) {
      const filteredNames = options.includeDisabled
        ? serverNames
        : serverNames.filter((name) => config.servers[name].enabled !== false);

      const response = JSONFormatter.withMetadata(
        filteredNames,
        undefined,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
      return;
    }

    // Full mode with server details
    const servers: ServerStatus[] = await Promise.all(
      serverNames.map(async (name) => {
        const serverConfig = config.servers[name];
        const enabled = serverConfig.enabled !== false;

        // Try to get server info if enabled
        let connected = false;
        let capabilities = undefined;
        let lastError = undefined;

        if (enabled) {
          try {
            const client = await clientPool.getClient(name);
            connected = client.isConnected();
            if (connected) {
              const info = await client.getServerInfo();
              capabilities = info.capabilities;
            }
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }

        return {
          name,
          connected,
          enabled,
          type: serverConfig.type,
          lastError,
          capabilities,
        };
      }),
    );

    // Filter out disabled servers if requested
    const filteredServers = options.includeDisabled
      ? servers
      : servers.filter((s) => s.enabled);

    const response = JSONFormatter.withMetadata(
      filteredServers,
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
 * Add a new server configuration
 */
export async function addServer(name: string, options: ServerAddOptions): Promise<void> {
  try {
    // Check if server already exists
    const config = await configLoader.getConfig();
    if (config.servers[name]) {
      throw Errors.serverAlreadyExists(name);
    }

    // Build server configuration based on type
    let serverConfig: ServerConfig;

    switch (options.type) {
      case "stdio":
        if (!options.command) {
          throw Errors.validationError("Command is required for stdio transport");
        }
        serverConfig = {
          type: "stdio",
          command: options.command,
          args: options.args,
          env: options.env,
          enabled: options.enabled ?? true,
        };
        break;

      case "sse":
        if (!options.url) {
          throw Errors.validationError("URL is required for SSE transport");
        }
        serverConfig = {
          type: "sse",
          url: options.url,
          apiKey: options.apiKey,
          headers: options.headers,
          enabled: options.enabled ?? true,
        };
        break;

      case "http":
        if (!options.url) {
          throw Errors.validationError("URL is required for HTTP transport");
        }
        serverConfig = {
          type: "http",
          url: options.url,
          apiKey: options.apiKey,
          headers: options.headers,
          enabled: options.enabled ?? true,
        };
        break;

      default:
        throw Errors.transportNotSupported(options.type);
    }

    // Validate configuration
    await ConfigValidator.validate(serverConfig);

    // Save to config
    await configLoader.setServer(name, serverConfig);

    // Add to client pool
    clientPool.addServer(name, serverConfig);

    const response = JSONFormatter.success({
      message: `Server '${name}' added successfully`,
      name,
      type: serverConfig.type,
    });
    JSONFormatter.output(response);
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}

/**
 * Remove a server configuration
 */
export async function removeServer(name: string): Promise<void> {
  try {
    // Check if server exists
    await configLoader.getServer(name);

    // Disconnect if connected
    await clientPool.disconnect(name);

    // Remove from pool
    clientPool.removeServer(name);

    // Remove from config
    await configLoader.removeServer(name);

    const response = JSONFormatter.success({
      message: `Server '${name}' removed successfully`,
      name,
    });
    JSONFormatter.output(response);
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}

/**
 * Test server connection
 */
export async function testServer(name: string): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info("Testing server connection", { server: name });

    const client = await clientPool.getClient(name);
    const info = await client.getServerInfo();

    const response = JSONFormatter.withMetadata(
      {
        connected: true,
        serverInfo: info,
      },
      name,
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
 * Get detailed server information
 */
export async function getServerInfo(name: string): Promise<void> {
  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(name);
    const info = await client.getServerInfo();

    const response = JSONFormatter.withMetadata(
      info,
      name,
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
 * Inspect server capabilities (high-level summary)
 */
export async function inspectServer(name: string): Promise<void> {
  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(name);

    // Get counts of available features
    const [tools, resources, prompts, info] = await Promise.all([
      client.listTools(),
      client.listResources(),
      client.listPrompts(),
      client.getServerInfo(),
    ]);

    const inspection = {
      tools: tools.length,
      resources: resources.length,
      prompts: prompts.length,
      capabilities: info.capabilities ? Object.keys(info.capabilities) : [],
    };

    const response = JSONFormatter.withMetadata(
      inspection,
      name,
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
 * Initialize MCP configuration
 * Creates a new config file with default settings
 */
export async function initConfig(options: ServerInitOptions): Promise<void> {
  try {
    let targetPath: string;

    // Determine where to create the config
    if (options.path) {
      targetPath = Platform.normalizePath(options.path);
    } else if (options.local) {
      targetPath = Platform.normalizePath("./.mcp-cli.json");
    } else {
      targetPath = Platform.getConfigPath();
    }

    // Check if config already exists
    const exists = await Platform.fileExists(targetPath);
    if (exists && !options.force) {
      throw Errors.validationError(
        `Configuration file already exists at ${targetPath}. Use --force to overwrite.`
      );
    }

    // Create config loader for target path
    const loader = new ConfigLoader(targetPath);
    const createdPath = await loader.createDefault(targetPath);

    const response = JSONFormatter.success({
      message: `Configuration initialized successfully`,
      path: createdPath,
      type: options.local ? "local" : "global",
    });
    JSONFormatter.output(response);
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}
