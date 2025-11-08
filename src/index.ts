#!/usr/bin/env node

/**
 * MCP CLI Bridge - Main entry point
 */

import { Command } from 'commander';
import { logger } from './utils/logger.js';
import { loadConfig } from './config/loader.js';
import {
  listServersCommand,
  addServerCommand,
  removeServerCommand,
  testServerCommand,
} from './commands/servers.js';
import {
  listToolsCommand,
  getToolSchemaCommand,
  executeToolCommand,
} from './commands/tools.js';
import {
  listResourcesCommand,
  readResourceCommand,
} from './commands/resources.js';
import {
  listPromptsCommand,
  getPromptCommand,
} from './commands/prompts.js';
import type { ServerConfig } from './types/config.js';

const program = new Command();

// Configure the main program
program
  .name('mcp-cli')
  .description('CLI bridge for interacting with Model Context Protocol (MCP) servers')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Suppress all logging')
  .hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();

    // Set log level based on flags
    if (opts.quiet) {
      logger.setLevel('error');
    } else if (opts.verbose) {
      logger.setLevel('debug');
    }

    // Load config to apply preferences
    try {
      const config = await loadConfig();
      if (config.preferences?.logLevel && !opts.verbose && !opts.quiet) {
        logger.setLevel(config.preferences.logLevel);
      }
    } catch (error) {
      // Ignore config errors during initialization
    }
  });

// Server management commands
const serversCmd = program
  .command('servers')
  .description('Manage MCP server configurations');

serversCmd
  .command('list')
  .description('List all configured servers')
  .action(async () => {
    const result = await listServersCommand();
    console.log(result);
  });

serversCmd
  .command('add <name>')
  .description('Add a new server configuration')
  .requiredOption('-t, --type <type>', 'Server type (stdio, sse, http)')
  .option('-c, --command <command>', 'Command to run (for stdio)')
  .option('-a, --args <args>', 'Command arguments as JSON array (for stdio)')
  .option('-u, --url <url>', 'Server URL (for sse/http)')
  .option('-k, --api-key <key>', 'API key (for sse)')
  .option('-H, --headers <headers>', 'Headers as JSON object (for sse/http)')
  .option('-e, --env <env>', 'Environment variables as JSON object (for stdio)')
  .action(async (name: string, options) => {
    try {
      let config: ServerConfig;

      switch (options.type) {
        case 'stdio':
          if (!options.command) {
            throw new Error('--command is required for stdio servers');
          }
          config = {
            type: 'stdio',
            command: options.command,
            args: options.args ? JSON.parse(options.args) : undefined,
            env: options.env ? JSON.parse(options.env) : undefined,
          };
          break;

        case 'sse':
          if (!options.url) {
            throw new Error('--url is required for SSE servers');
          }
          config = {
            type: 'sse',
            url: options.url,
            apiKey: options.apiKey,
            headers: options.headers ? JSON.parse(options.headers) : undefined,
          };
          break;

        case 'http':
          if (!options.url) {
            throw new Error('--url is required for HTTP servers');
          }
          config = {
            type: 'http',
            url: options.url,
            headers: options.headers ? JSON.parse(options.headers) : undefined,
          };
          break;

        default:
          throw new Error(`Unknown server type: ${options.type}`);
      }

      const result = await addServerCommand(name, config);
      console.log(result);
    } catch (error) {
      console.error(JSON.stringify({
        success: false,
        error: {
          code: 'COMMAND_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      }, null, 2));
      process.exit(1);
    }
  });

serversCmd
  .command('remove <name>')
  .description('Remove a server configuration')
  .action(async (name: string) => {
    const result = await removeServerCommand(name);
    console.log(result);
  });

serversCmd
  .command('test <name>')
  .description('Test connection to a server')
  .action(async (name: string) => {
    const result = await testServerCommand(name);
    console.log(result);
  });

// Tool commands
const toolsCmd = program
  .command('tools')
  .description('Interact with MCP server tools');

toolsCmd
  .command('list <server>')
  .description('List available tools from a server')
  .action(async (server: string) => {
    const result = await listToolsCommand(server);
    console.log(result);
  });

toolsCmd
  .command('schema <server> <tool>')
  .description('Get the schema for a specific tool')
  .action(async (server: string, tool: string) => {
    const result = await getToolSchemaCommand(server, tool);
    console.log(result);
  });

toolsCmd
  .command('exec <server> <tool>')
  .description('Execute a tool with arguments')
  .requiredOption('--args <json>', 'Tool arguments as JSON object')
  .action(async (server: string, tool: string, options) => {
    const result = await executeToolCommand(server, tool, options.args);
    console.log(result);
  });

// Resource commands
const resourcesCmd = program
  .command('resources')
  .description('Interact with MCP server resources');

resourcesCmd
  .command('list <server>')
  .description('List available resources from a server')
  .action(async (server: string) => {
    const result = await listResourcesCommand(server);
    console.log(result);
  });

resourcesCmd
  .command('read <server> <uri>')
  .description('Read a resource by URI')
  .action(async (server: string, uri: string) => {
    const result = await readResourceCommand(server, uri);
    console.log(result);
  });

// Prompt commands
const promptsCmd = program
  .command('prompts')
  .description('Interact with MCP server prompts');

promptsCmd
  .command('list <server>')
  .description('List available prompts from a server')
  .action(async (server: string) => {
    const result = await listPromptsCommand(server);
    console.log(result);
  });

promptsCmd
  .command('get <server> <prompt>')
  .description('Get a prompt with arguments')
  .option('--args <json>', 'Prompt arguments as JSON object', '{}')
  .action(async (server: string, prompt: string, options) => {
    const result = await getPromptCommand(server, prompt, options.args);
    console.log(result);
  });

// Parse arguments
program.parse();
