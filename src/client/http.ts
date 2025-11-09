import type { HTTPServerConfig } from "../types/config.ts";
import type {
  Prompt,
  PromptResult,
  Resource,
  ResourceContents,
  ServerInfo,
  Tool,
  ToolResult,
} from "../types/mcp.ts";
import { BaseMCPClient } from "./base.ts";
import { logger } from "../utils/logger.ts";
import { Errors } from "../utils/errors.ts";

/**
 * HTTP transport implementation for MCP
 * Note: This is a simplified implementation as HTTP transport is less common
 * and the MCP SDK doesn't provide a built-in HTTP transport yet
 */
export class HTTPMCPClient extends BaseMCPClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(
    private serverName: string,
    config: HTTPServerConfig,
  ) {
    super();
    this.baseUrl = config.url;
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    if (config.apiKey) {
      this.headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    if (config.timeout) {
      this.setTimeout(config.timeout);
    }
  }

  async connect(): Promise<void> {
    if (this.connected) {
      logger.debug("Already connected", { server: this.serverName });
      return;
    }

    logger.info("Connecting to HTTP MCP server", {
      server: this.serverName,
      url: this.baseUrl,
    });

    try {
      // Test connection by getting server info
      await this.getServerInfo();
      this.connected = true;
      logger.info("Connected successfully", { server: this.serverName });
    } catch (error) {
      logger.error("Failed to connect", { server: this.serverName, error });
      throw Errors.serverConnectionFailed(
        this.serverName,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info("Disconnecting from server", { server: this.serverName });
    this.connected = false;
  }

  private async request<T>(
    endpoint: string,
    method: string = "POST",
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw Errors.serverTimeout(this.serverName, this.timeout);
      }

      throw error;
    }
  }

  async getServerInfo(): Promise<ServerInfo> {
    const result = await this.request<{ name: string; version: string }>("/info", "GET");

    return {
      name: this.serverName,
      version: result.version || "unknown",
    };
  }

  async listTools(): Promise<Tool[]> {
    this.ensureConnected();

    const result = await this.request<{ tools: Tool[] }>("/tools", "GET");
    return result.tools || [];
  }

  async getTool(name: string): Promise<Tool | null> {
    const tools = await this.listTools();
    return tools.find((t) => t.name === name) || null;
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    this.ensureConnected();

    logger.debug("Executing tool", { server: this.serverName, tool: name, args });

    try {
      const result = await this.request<ToolResult>("/tools/execute", "POST", {
        name,
        arguments: args,
      });

      return result;
    } catch (error) {
      logger.error("Tool execution failed", { server: this.serverName, tool: name, error });
      throw Errors.toolExecutionFailed(
        name,
        this.serverName,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
      );
    }
  }

  async listResources(): Promise<Resource[]> {
    this.ensureConnected();

    const result = await this.request<{ resources: Resource[] }>("/resources", "GET");
    return result.resources || [];
  }

  async readResource(uri: string): Promise<ResourceContents> {
    this.ensureConnected();

    logger.debug("Reading resource", { server: this.serverName, uri });

    try {
      const result = await this.request<ResourceContents>("/resources/read", "POST", { uri });
      return result;
    } catch (error) {
      logger.error("Resource read failed", { server: this.serverName, uri, error });
      throw Errors.wrap(error);
    }
  }

  async listPrompts(): Promise<Prompt[]> {
    this.ensureConnected();

    const result = await this.request<{ prompts: Prompt[] }>("/prompts", "GET");
    return result.prompts || [];
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<PromptResult> {
    this.ensureConnected();

    logger.debug("Getting prompt", { server: this.serverName, prompt: name, args });

    try {
      const result = await this.request<PromptResult>("/prompts/get", "POST", {
        name,
        arguments: args,
      });

      return result;
    } catch (error) {
      logger.error("Get prompt failed", { server: this.serverName, prompt: name, error });
      throw Errors.wrap(error);
    }
  }
}
