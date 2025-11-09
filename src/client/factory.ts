import type { ServerConfig } from "../types/config.ts";
import type { MCPClientAdapter } from "./base.ts";
import { StdioMCPClient } from "./stdio.ts";
import { SSEMCPClient } from "./sse.ts";
import { HTTPMCPClient } from "./http.ts";
import { Errors } from "../utils/errors.ts";
import { logger } from "../utils/logger.ts";

/**
 * Factory for creating MCP client instances based on server configuration
 */
export class MCPClientFactory {
  /**
   * Create an MCP client based on server configuration
   */
  static create(serverName: string, config: ServerConfig): MCPClientAdapter {
    logger.debug("Creating MCP client", { server: serverName, type: config.type });

    switch (config.type) {
      case "stdio":
        return new StdioMCPClient(serverName, config);

      case "sse":
        return new SSEMCPClient(serverName, config);

      case "http":
        return new HTTPMCPClient(serverName, config);

      default:
        // TypeScript should catch this, but just in case
        throw Errors.transportNotSupported((config as { type: string }).type);
    }
  }

  /**
   * Create and connect to an MCP client
   */
  static async createAndConnect(
    serverName: string,
    config: ServerConfig,
  ): Promise<MCPClientAdapter> {
    const client = this.create(serverName, config);

    try {
      await client.connect();
      return client;
    } catch (error) {
      // Ensure cleanup on connection failure
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      throw error;
    }
  }
}

/**
 * Connection pool for managing multiple MCP client connections
 */
export class MCPClientPool {
  private clients = new Map<string, MCPClientAdapter>();
  private configs = new Map<string, ServerConfig>();

  /**
   * Add a server configuration to the pool
   */
  addServer(name: string, config: ServerConfig): void {
    this.configs.set(name, config);
  }

  /**
   * Remove a server from the pool
   */
  removeServer(name: string): void {
    this.configs.delete(name);
    // Disconnect and remove client if exists
    const client = this.clients.get(name);
    if (client) {
      client.disconnect().catch(() => {
        // Ignore disconnect errors
      });
      this.clients.delete(name);
    }
  }

  /**
   * Get or create a connected client for a server
   */
  async getClient(serverName: string): Promise<MCPClientAdapter> {
    // Check if client already exists and is connected
    const existing = this.clients.get(serverName);
    if (existing && existing.isConnected()) {
      return existing;
    }

    // Get server configuration
    const config = this.configs.get(serverName);
    if (!config) {
      throw Errors.serverNotFound(serverName, Array.from(this.configs.keys()));
    }

    // Check if server is enabled
    if (config.enabled === false) {
      throw Errors.serverDisabled(serverName);
    }

    // Create and connect new client
    const client = await MCPClientFactory.createAndConnect(serverName, config);
    this.clients.set(serverName, client);

    return client;
  }

  /**
   * Disconnect a specific client
   */
  async disconnect(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverName);
    }
  }

  /**
   * Disconnect all clients
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map((client) =>
      client.disconnect().catch(() => {
        // Ignore errors during shutdown
      })
    );

    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  /**
   * Get all connected server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.entries())
      .filter(([_, client]) => client.isConnected())
      .map(([name, _]) => name);
  }

  /**
   * Get all configured server names
   */
  getConfiguredServers(): string[] {
    return Array.from(this.configs.keys());
  }
}

/**
 * Default client pool instance
 */
export const clientPool = new MCPClientPool();
