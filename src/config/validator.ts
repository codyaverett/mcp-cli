import { serverConfigSchema } from "./schema.ts";
import type { ServerConfig } from "../types/config.ts";
import { Errors } from "../utils/errors.ts";
import { logger } from "../utils/logger.ts";
import { Platform } from "../utils/platform.ts";

/**
 * Configuration validator
 */
export class ConfigValidator {
  /**
   * Validate server configuration
   */
  static validateServerConfig(config: unknown): ServerConfig {
    try {
      return serverConfigSchema.parse(config);
    } catch (error) {
      logger.error("Server configuration validation failed", { error });
      throw Errors.validationError(
        "Invalid server configuration",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * Validate stdio server configuration
   */
  static async validateStdioConfig(config: ServerConfig): Promise<void> {
    if (config.type !== "stdio") {
      return;
    }

    // Check if command exists (basic check)
    const command = config.command;

    // Expand home directory if needed
    const expandedCommand = Platform.expandHome(command);

    // Check if it's an absolute path
    if (expandedCommand.startsWith("/") || expandedCommand.startsWith("\\")) {
      const exists = await Platform.fileExists(expandedCommand);
      if (!exists) {
        logger.warn(`Command not found at path: ${expandedCommand}`);
      }
    }

    // Validate working directory if specified
    if (config.cwd) {
      const expandedCwd = Platform.expandHome(config.cwd);
      const exists = await Platform.dirExists(expandedCwd);
      if (!exists) {
        logger.warn(`Working directory not found: ${expandedCwd}`);
      }
    }
  }

  /**
   * Validate SSE server configuration
   */
  static validateSSEConfig(config: ServerConfig): void {
    if (config.type !== "sse") {
      return;
    }

    // Validate URL format
    try {
      new URL(config.url);
    } catch {
      throw Errors.validationError(`Invalid SSE URL: ${config.url}`);
    }

    // Check for HTTPS in production
    if (!config.url.startsWith("https://") && !config.url.includes("localhost")) {
      logger.warn("SSE URL is not using HTTPS", { url: config.url });
    }
  }

  /**
   * Validate HTTP server configuration
   */
  static validateHTTPConfig(config: ServerConfig): void {
    if (config.type !== "http") {
      return;
    }

    // Validate URL format
    try {
      new URL(config.url);
    } catch {
      throw Errors.validationError(`Invalid HTTP URL: ${config.url}`);
    }

    // Check for HTTPS in production
    if (!config.url.startsWith("https://") && !config.url.includes("localhost")) {
      logger.warn("HTTP URL is not using HTTPS", { url: config.url });
    }
  }

  /**
   * Validate any server configuration (runs all relevant validators)
   */
  static async validate(config: ServerConfig): Promise<void> {
    // First validate against schema
    this.validateServerConfig(config);

    // Then run transport-specific validation
    switch (config.type) {
      case "stdio":
        await this.validateStdioConfig(config);
        break;
      case "sse":
        this.validateSSEConfig(config);
        break;
      case "http":
        this.validateHTTPConfig(config);
        break;
    }
  }

  /**
   * Validate timeout value
   */
  static validateTimeout(timeout: number): void {
    if (timeout <= 0) {
      throw Errors.validationError("Timeout must be positive");
    }

    if (timeout > 300000) {
      logger.warn("Very long timeout specified", { timeout });
    }
  }

  /**
   * Validate retry count
   */
  static validateRetries(retries: number): void {
    if (retries < 0) {
      throw Errors.validationError("Retries must be non-negative");
    }

    if (retries > 10) {
      logger.warn("High retry count specified", { retries });
    }
  }
}
