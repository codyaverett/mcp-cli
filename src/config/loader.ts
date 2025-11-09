import { parse as parseJSON } from "@std/jsonc";
import { Platform } from "../utils/platform.ts";
import { logger } from "../utils/logger.ts";
import { Errors } from "../utils/errors.ts";
import type { Config, ServerConfig } from "../types/config.ts";
import { configSchema } from "./schema.ts";

/**
 * Configuration loader with environment variable substitution
 */
export class ConfigLoader {
  private configPath: string | null = null;
  private explicitPath: string | undefined;
  private config: Config | null = null;

  constructor(configPath?: string) {
    this.explicitPath = configPath;
  }

  /**
   * Resolve the config path using priority system
   */
  private async resolveConfigPath(): Promise<string> {
    if (!this.configPath) {
      this.configPath = await Platform.resolveConfigPath(this.explicitPath);
    }
    return this.configPath;
  }

  /**
   * Load configuration from file
   */
  async load(): Promise<Config> {
    const configPath = await this.resolveConfigPath();
    logger.debug("Loading configuration", { path: configPath });

    // Check if config file exists
    const exists = await Platform.fileExists(configPath);
    if (!exists) {
      logger.info("Configuration file not found, using empty config", {
        path: configPath,
      });
      this.config = { servers: {} };
      return this.config;
    }

    try {
      // Read and parse config file (supports JSON and JSONC)
      const content = await Deno.readTextFile(configPath);
      const parsed = parseJSON(content) as unknown;

      // Validate schema
      const validated = configSchema.parse(parsed);

      // Substitute environment variables
      this.config = this.substituteEnvVars(validated);

      logger.info("Configuration loaded successfully", {
        path: configPath,
        servers: Object.keys(this.config.servers).length,
      });

      return this.config;
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        throw Errors.permissionDenied(configPath, "read");
      }

      logger.error("Failed to load configuration", { error });
      throw Errors.configParseError(configPath, error as Error);
    }
  }

  /**
   * Save configuration to file
   */
  async save(config: Config): Promise<void> {
    const configPath = await this.resolveConfigPath();
    logger.debug("Saving configuration", { path: configPath });

    try {
      // Validate before saving
      configSchema.parse(config);

      // Ensure config directory exists
      const configDir = configPath.substring(0, configPath.lastIndexOf("/"));
      await Platform.ensureDir(configDir);

      // Write config file
      const content = JSON.stringify(config, null, 2);
      await Deno.writeTextFile(configPath, content);

      this.config = config;

      logger.info("Configuration saved successfully", { path: configPath });
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        throw Errors.permissionDenied(configPath, "write");
      }

      logger.error("Failed to save configuration", { error });
      throw error;
    }
  }

  /**
   * Get current configuration (loads if not already loaded)
   */
  async getConfig(): Promise<Config> {
    if (!this.config) {
      await this.load();
    }
    return this.config!;
  }

  /**
   * Get a specific server configuration
   */
  async getServer(name: string): Promise<ServerConfig> {
    const config = await this.getConfig();

    if (!config.servers[name]) {
      throw Errors.serverNotFound(name, Object.keys(config.servers));
    }

    return config.servers[name];
  }

  /**
   * Add or update a server configuration
   */
  async setServer(name: string, serverConfig: ServerConfig): Promise<void> {
    const config = await this.getConfig();
    config.servers[name] = serverConfig;
    await this.save(config);
  }

  /**
   * Remove a server configuration
   */
  async removeServer(name: string): Promise<void> {
    const config = await this.getConfig();

    if (!config.servers[name]) {
      throw Errors.serverNotFound(name, Object.keys(config.servers));
    }

    delete config.servers[name];
    await this.save(config);
  }

  /**
   * List all server names
   */
  async listServers(): Promise<string[]> {
    const config = await this.getConfig();
    return Object.keys(config.servers);
  }

  /**
   * Substitute environment variables in configuration
   * Supports ${VAR_NAME} syntax
   */
  private substituteEnvVars(config: Config): Config {
    const envVarPattern = /\$\{([^}]+)\}/g;

    const substitute = (value: unknown): unknown => {
      if (typeof value === "string") {
        return value.replace(envVarPattern, (_match, varName: string) => {
          const envValue = Deno.env.get(varName);
          if (envValue === undefined) {
            logger.warn(`Environment variable not found: ${varName}`);
            return "";
          }
          return envValue;
        });
      }

      if (Array.isArray(value)) {
        return value.map(substitute);
      }

      if (value !== null && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = substitute(val);
        }
        return result;
      }

      return value;
    };

    return substitute(config) as Config;
  }

  /**
   * Get config file path
   */
  async getConfigPath(): Promise<string> {
    return await this.resolveConfigPath();
  }

  /**
   * Check if config file exists
   */
  async exists(): Promise<boolean> {
    const configPath = await this.resolveConfigPath();
    return await Platform.fileExists(configPath);
  }

  /**
   * Create default configuration file
   * @param path - Optional explicit path to create config at
   */
  async createDefault(path?: string): Promise<string> {
    const defaultConfig: Config = {
      servers: {},
      preferences: {
        defaultTimeout: 30000,
        maxRetries: 3,
        cacheSchemas: true,
        cacheTTL: 300,
      },
    };

    // If path is provided, temporarily override the config path
    const originalExplicitPath = this.explicitPath;
    if (path) {
      this.explicitPath = path;
      this.configPath = null; // Force re-resolution
    }

    await this.save(defaultConfig);
    const savedPath = await this.resolveConfigPath();

    // Restore original path
    this.explicitPath = originalExplicitPath;
    this.configPath = null;

    return savedPath;
  }
}

/**
 * Default config loader instance
 */
export const configLoader = new ConfigLoader();
