#!/usr/bin/env -S deno run --allow-all

import { Command } from "@cliffy/command";
import { logger } from "./utils/logger.ts";
import { LogLevel } from "./types/config.ts";
import { configLoader } from "./config/loader.ts";
import { clientPool } from "./client/factory.ts";

// Import command handlers
import * as serversCmd from "./commands/servers.ts";
import * as toolsCmd from "./commands/tools.ts";
import * as resourcesCmd from "./commands/resources.ts";
import * as promptsCmd from "./commands/prompts.ts";
import * as searchCmd from "./commands/search.ts";

/**
 * Main CLI application
 */
const cli = new Command()
  .name("mcp")
  .version("1.0.0")
  .description(
    "MCP CLI Bridge - Progressive disclosure CLI for Model Context Protocol servers",
  )
  .globalOption(
    "--config <path:string>",
    "Path to configuration file",
  )
  .globalOption(
    "-v, --verbose",
    "Enable verbose logging (can be used multiple times)",
    {
      collect: true,
    },
  )
  .globalAction(async (options) => {
    // Set log level based on verbosity
    if (Array.isArray(options.verbose)) {
      const verbosity = options.verbose.length;
      if (verbosity >= 2) {
        logger.setLevel(LogLevel.TRACE);
      } else if (verbosity === 1) {
        logger.setLevel(LogLevel.DEBUG);
      }
    }

    // Load configuration from custom path if specified
    if (options.config && typeof options.config === "string") {
      const customLoader = new (await import("./config/loader.ts")).ConfigLoader(options.config);
      const config = await customLoader.load();

      // Update client pool with loaded config
      for (const [name, serverConfig] of Object.entries(config.servers)) {
        clientPool.addServer(name, serverConfig);
      }
    } else {
      // Load default configuration
      const config = await configLoader.load();

      // Update client pool with loaded config
      for (const [name, serverConfig] of Object.entries(config.servers)) {
        clientPool.addServer(name, serverConfig);
      }
    }
  });

// Servers command group
const serversCommand = new Command()
  .name("servers")
  .description("Manage MCP server connections")
  .action(function () {
    this.showHelp();
  });

serversCommand
  .command("list")
  .description("List configured servers")
  .option("--names-only", "Show only server names (minimal context)")
  .option("--full", "Show full server details including status")
  .option("--include-disabled", "Include disabled servers in the list")
  .action(async (options) => {
    await serversCmd.listServers(options);
  });

serversCommand
  .command("add <name:string>")
  .description("Add a new server configuration")
  .option("-t, --type <type:string>", "Transport type (stdio, sse, http)", { required: true })
  .option("--command <cmd:string>", "Command for stdio transport")
  .option("--args <args...:string>", "Arguments for stdio command")
  .option("--url <url:string>", "URL for SSE or HTTP transport")
  .option("--api-key <key:string>", "API key for authentication")
  .option("--env <vars...:string>", "Environment variables (KEY=value format)")
  .option("--disabled", "Add server in disabled state")
  .action(async (options, name) => {
    // Parse environment variables
    const env: Record<string, string> = {};
    if (options.env) {
      for (const envVar of options.env) {
        const [key, ...valueParts] = envVar.split("=");
        if (key && valueParts.length > 0) {
          env[key] = valueParts.join("=");
        }
      }
    }

    await serversCmd.addServer(name, {
      name,
      type: options.type as "stdio" | "sse" | "http",
      command: options.command,
      args: options.args,
      url: options.url,
      apiKey: options.apiKey,
      env: Object.keys(env).length > 0 ? env : undefined,
      enabled: !options.disabled,
    });
  });

serversCommand
  .command("remove <name:string>")
  .description("Remove a server configuration")
  .action(async (_options, name) => {
    await serversCmd.removeServer(name);
  });

serversCommand
  .command("test <name:string>")
  .description("Test connection to a server")
  .action(async (_options, name) => {
    await serversCmd.testServer(name);
  });

serversCommand
  .command("info <name:string>")
  .description("Get detailed server information")
  .action(async (_options, name) => {
    await serversCmd.getServerInfo(name);
  });

serversCommand
  .command("inspect <name:string>")
  .description("Inspect server capabilities (high-level summary)")
  .action(async (_options, name) => {
    await serversCmd.inspectServer(name);
  });

serversCommand
  .command("init")
  .description("Initialize MCP configuration file")
  .option("--local", "Create config in current directory (.mcp-cli.json)")
  .option("--path <path:string>", "Create config at specific path")
  .option("--force", "Overwrite existing configuration file")
  .action(async (options) => {
    await serversCmd.initConfig(options);
  });

// Tools command group
const toolsCommand = new Command()
  .name("tools")
  .description("Manage and execute tools (progressive disclosure)")
  .action(function () {
    this.showHelp();
  });

toolsCommand
  .command("list [server:string]")
  .description("List tools from a server")
  .option("--names-only", "Show only tool names (minimal context, default)")
  .option("--brief", "Show brief descriptions (moderate context)")
  .option("--full", "Show full schemas (high context)")
  .option("--category <cat:string>", "Filter by category")
  .action(async (options, server) => {
    await toolsCmd.listTools(server, options);
  });

toolsCommand
  .command("schema [server:string] [tools...:string]")
  .description("Get schema for specific tool(s) - just-in-time loading")
  .action(async (_options, server, ...tools) => {
    await toolsCmd.getToolSchema(server, tools);
  });

toolsCommand
  .command("exec [server:string] [tool:string]")
  .description("Execute a tool")
  .option("--args <json:string>", "Tool arguments as JSON")
  .option("--max-tokens <num:number>", "Maximum tokens in response (truncate if needed)")
  .action(async (options, server, tool) => {
    if (!server || !tool || !options.args) {
      await toolsCmd.executeTool({
        server,
        tool,
        args: options.args ? JSON.parse(options.args) : undefined,
        maxTokens: options.maxTokens,
      });
      return;
    }
    const args = JSON.parse(options.args);
    await toolsCmd.executeTool({
      server,
      tool,
      args,
      maxTokens: options.maxTokens,
    });
  });

toolsCommand
  .command("search <server:string> <query:string>")
  .description("Search for tools on a server")
  .action(async (_options, server, query) => {
    await toolsCmd.searchTools(server, query);
  });

toolsCommand
  .command("batch <server:string>")
  .description("Execute multiple tools sequentially without disconnecting")
  .option("--operations <json:string>", "Batch operations as JSON array", { required: true })
  .option("--transactional", "Fail entire batch if any operation fails")
  .action(async (options, server) => {
    if (!options.operations) {
      console.error("Error: --operations is required");
      Deno.exit(1);
    }

    try {
      const operations = JSON.parse(options.operations);

      // Validate operations structure
      if (!Array.isArray(operations)) {
        console.error("Error: --operations must be a JSON array");
        Deno.exit(1);
      }

      // Add server name to each operation
      const batchOps = operations.map((op) => ({
        server,
        tool: op.tool,
        args: op.args || {},
        outputVar: op.outputVar,
      }));

      await toolsCmd.executeBatch({
        operations: batchOps,
        transactional: options.transactional,
      });
    } catch (error) {
      console.error("Error parsing operations JSON:", error.message);
      Deno.exit(1);
    }
  });

// Resources command group
const resourcesCommand = new Command()
  .name("resources")
  .description("Manage MCP resources")
  .action(function () {
    this.showHelp();
  });

resourcesCommand
  .command("list [server:string]")
  .description("List resources from a server")
  .option("--names-only", "Show only resource URIs (minimal context)")
  .action(async (options, server) => {
    await resourcesCmd.listResources(server, options);
  });

resourcesCommand
  .command("read [server:string] [uri:string]")
  .description("Read a specific resource")
  .option("--max-tokens <num:number>", "Maximum tokens in response")
  .action(async (options, server, uri) => {
    await resourcesCmd.readResource({
      server,
      uri,
      maxTokens: options.maxTokens,
    });
  });

resourcesCommand
  .command("schema <server:string> <uri:string>")
  .description("Get resource metadata/schema")
  .action(async (_options, server, uri) => {
    await resourcesCmd.getResourceSchema(server, uri);
  });

resourcesCommand
  .command("search <server:string> <pattern:string>")
  .description("Search resources by pattern")
  .action(async (_options, server, pattern) => {
    await resourcesCmd.searchResources(server, pattern);
  });

// Prompts command group
const promptsCommand = new Command()
  .name("prompts")
  .description("Manage MCP prompts")
  .action(function () {
    this.showHelp();
  });

promptsCommand
  .command("list [server:string]")
  .description("List available prompts")
  .option("--names-only", "Show only prompt names (minimal context)")
  .action(async (options, server) => {
    await promptsCmd.listPrompts(server, options);
  });

promptsCommand
  .command("schema [server:string] [prompt:string]")
  .description("Get prompt schema (required arguments)")
  .action(async (_options, server, prompt) => {
    await promptsCmd.getPromptSchema(server, prompt);
  });

promptsCommand
  .command("get [server:string] [prompt:string]")
  .description("Get/execute a prompt with arguments")
  .option("--args <json:string>", "Prompt arguments as JSON")
  .action(async (options, server, prompt) => {
    const args = options.args ? JSON.parse(options.args) : undefined;
    await promptsCmd.getPrompt({
      server,
      prompt,
      args,
    });
  });

// Search command
const searchCommand = new Command()
  .name("search")
  .description("Search for tools across all servers")
  .arguments("<query:string>")
  .option("--limit <num:number>", "Limit number of results")
  .option("--detailed", "Include brief descriptions (moderate context)")
  .action(async (options, query) => {
    if (options.detailed) {
      await searchCmd.searchToolsDetailed(query, options.limit);
    } else {
      await searchCmd.searchAllServers(query, options.limit);
    }
  });

// Recommend command
const recommendCommand = new Command()
  .name("recommend")
  .description("Get tool recommendations for a task description")
  .arguments("<task:string>")
  .action(async (_options, task) => {
    await searchCmd.recommendTools(task);
  });

// Inspect command (alias for servers inspect, but works without "servers" prefix)
const inspectCommand = new Command()
  .name("inspect")
  .description("Inspect server capabilities")
  .arguments("<server:string>")
  .action(async (_options, server) => {
    await serversCmd.inspectServer(server);
  });

// Add all commands to main CLI
cli.command("servers", serversCommand);
cli.command("tools", toolsCommand);
cli.command("resources", resourcesCommand);
cli.command("prompts", promptsCommand);
cli.command("search", searchCommand);
cli.command("recommend", recommendCommand);
cli.command("inspect", inspectCommand);

// Cleanup on exit
Deno.addSignalListener("SIGINT", async () => {
  logger.info("Shutting down...");
  await clientPool.disconnectAll();
  Deno.exit(0);
});

Deno.addSignalListener("SIGTERM", async () => {
  logger.info("Shutting down...");
  await clientPool.disconnectAll();
  Deno.exit(0);
});

// Run CLI
if (import.meta.main) {
  try {
    await cli.parse(Deno.args);
  } catch (error) {
    logger.error("CLI error", { error });
    Deno.exit(1);
  } finally {
    // Cleanup connections
    await clientPool.disconnectAll();
  }
}

export { cli };
