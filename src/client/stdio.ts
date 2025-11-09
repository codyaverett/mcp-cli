import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { StdioServerConfig } from "../types/config.ts";
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
import { Platform } from "../utils/platform.ts";

/**
 * Stdio transport implementation for MCP
 */
export class StdioMCPClient extends BaseMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private process: Deno.ChildProcess | null = null;

  constructor(
    private serverName: string,
    private config: StdioServerConfig,
  ) {
    super();
    if (config.timeout) {
      this.setTimeout(config.timeout);
    }
  }

  async connect(): Promise<void> {
    if (this.connected) {
      logger.debug("Already connected", { server: this.serverName });
      return;
    }

    logger.info("Connecting to stdio MCP server", {
      server: this.serverName,
      command: this.config.command,
    });

    try {
      // Expand home directory in command and cwd
      const command = Platform.expandHome(this.config.command);
      const cwd = this.config.cwd ? Platform.expandHome(this.config.cwd) : undefined;

      // Create command for Deno subprocess
      const cmd = new Deno.Command(command, {
        args: this.config.args || [],
        env: this.config.env || {},
        cwd,
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
      });

      // Spawn the process
      this.process = cmd.spawn();

      // Create stdio transport using the spawned process
      this.transport = new StdioClientTransport({
        command: command,
        args: this.config.args || [],
        env: this.config.env || {},
      });

      // Create MCP client
      this.client = new Client(
        {
          name: "mcp-cli",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      // Connect to the server
      await this.createTimeoutPromise(
        this.client.connect(this.transport),
      );

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

    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }

      if (this.process) {
        this.process.kill();
        this.process = null;
      }

      this.connected = false;
      logger.info("Disconnected successfully", { server: this.serverName });
    } catch (error) {
      logger.error("Error during disconnect", { server: this.serverName, error });
      // Don't throw on disconnect errors
      this.connected = false;
    }
  }

  async getServerInfo(): Promise<ServerInfo> {
    this.ensureConnected();

    const rawResult = this.client!.getServerVersion();
    const result = rawResult as unknown as {
      protocolVersion?: string;
      capabilities?: unknown;
      serverInfo?: unknown;
    };

    return {
      name: this.serverName,
      version: result.protocolVersion || "unknown",
      protocolVersion: result.protocolVersion,
      capabilities: result.capabilities as ServerInfo["capabilities"],
      serverInfo: result.serverInfo as ServerInfo["serverInfo"],
    };
  }

  async listTools(): Promise<Tool[]> {
    this.ensureConnected();

    const result = await this.createTimeoutPromise(
      this.client!.listTools(),
    );

    return (result.tools || []) as Tool[];
  }

  async getTool(name: string): Promise<Tool | null> {
    const tools = await this.listTools();
    return tools.find((t) => t.name === name) || null;
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    this.ensureConnected();

    logger.debug("Executing tool", { server: this.serverName, tool: name, args });

    try {
      const result = await this.createTimeoutPromise(
        this.client!.callTool({ name, arguments: args }),
      );

      return {
        content: result.content as ToolResult["content"],
        isError: result.isError as boolean | undefined,
      };
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

    const result = await this.createTimeoutPromise(
      this.client!.listResources(),
    );

    return result.resources || [];
  }

  async readResource(uri: string): Promise<ResourceContents> {
    this.ensureConnected();

    logger.debug("Reading resource", { server: this.serverName, uri });

    try {
      const result = await this.createTimeoutPromise(
        this.client!.readResource({ uri }),
      );

      return {
        uri,
        contents: result.contents as unknown as ResourceContents["contents"],
      };
    } catch (error) {
      logger.error("Resource read failed", { server: this.serverName, uri, error });
      throw Errors.wrap(error);
    }
  }

  async listPrompts(): Promise<Prompt[]> {
    this.ensureConnected();

    const result = await this.createTimeoutPromise(
      this.client!.listPrompts(),
    );

    return result.prompts || [];
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<PromptResult> {
    this.ensureConnected();

    logger.debug("Getting prompt", { server: this.serverName, prompt: name, args });

    try {
      const result = await this.createTimeoutPromise(
        this.client!.getPrompt({ name, arguments: args }),
      );

      return {
        description: result.description,
        messages: (result.messages || []) as PromptResult["messages"],
      };
    } catch (error) {
      logger.error("Get prompt failed", { server: this.serverName, prompt: name, error });
      throw Errors.wrap(error);
    }
  }
}
