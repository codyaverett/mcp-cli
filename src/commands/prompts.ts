import { clientPool } from "../client/factory.ts";
import { configLoader } from "../config/loader.ts";
import { JSONFormatter } from "../utils/json.ts";
import { logger } from "../utils/logger.ts";
import { Errors } from "../utils/errors.ts";
import type { ListOptions, PromptGetOptions } from "../types/commands.ts";

/**
 * Helper to show available servers when server argument is missing
 */
async function showAvailableServers(): Promise<void> {
  const config = await configLoader.getConfig();
  const servers = Object.keys(config.servers);

  if (servers.length === 0) {
    const error = Errors.validationError(
      "No server specified",
    );
    error.suggestion =
      "No servers configured. Run 'mcp servers init' then 'mcp servers add <name> --type stdio --command <cmd>' to add your first server";
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
  }

  const error = Errors.validationError(
    "No server specified",
  );
  error.suggestion = `Available servers: ${servers.join(", ")}`;
  JSONFormatter.output(error.toJSON());
  Deno.exit(1);
}

/**
 * List prompts from a server
 */
export async function listPrompts(
  serverName: string | undefined,
  options: ListOptions,
): Promise<void> {
  if (!serverName) {
    await showAvailableServers();
    return;
  }

  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(serverName);
    const prompts = await client.listPrompts();

    // Names only mode (minimal context)
    if (options.namesOnly) {
      const names = prompts.map((p) => p.name);

      const response = JSONFormatter.withMetadata(
        names,
        serverName,
        Date.now() - startTime,
      );
      JSONFormatter.output(response);
      return;
    }

    // Full mode with all details
    const response = JSONFormatter.withMetadata(
      prompts,
      serverName,
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
 * Get schema for a specific prompt (shows required arguments)
 */
export async function getPromptSchema(
  serverName: string | undefined,
  promptName: string | undefined,
): Promise<void> {
  if (!serverName) {
    await showAvailableServers();
    return;
  }

  if (!promptName) {
    const error = Errors.validationError(
      "No prompt name specified",
    );
    error.suggestion = `Usage: mcp prompts schema ${serverName} <prompt-name>`;
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
  }

  const startTime = Date.now();

  try {
    const client = await clientPool.getClient(serverName);
    const prompts = await client.listPrompts();

    const prompt = prompts.find((p) => p.name === promptName);
    if (!prompt) {
      throw Errors.promptNotFound(
        promptName,
        serverName,
        prompts.map((p) => p.name),
      );
    }

    const response = JSONFormatter.withMetadata(
      prompt,
      serverName,
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
 * Get/execute a prompt with arguments
 */
export async function getPrompt(options: PromptGetOptions): Promise<void> {
  if (!options.server) {
    await showAvailableServers();
    return;
  }

  if (!options.prompt) {
    const error = Errors.validationError(
      "No prompt name specified",
    );
    error.suggestion = `Usage: mcp prompts get ${options.server} <prompt-name> [--args <json>]`;
    JSONFormatter.output(error.toJSON());
    Deno.exit(1);
  }

  const startTime = Date.now();

  try {
    logger.info("Getting prompt", {
      server: options.server,
      prompt: options.prompt,
    });

    const client = await clientPool.getClient(options.server);

    // Validate prompt exists
    const prompts = await client.listPrompts();
    const promptDef = prompts.find((p) => p.name === options.prompt);
    if (!promptDef) {
      throw Errors.promptNotFound(
        options.prompt,
        options.server,
        prompts.map((p) => p.name),
      );
    }

    // Get the prompt with arguments
    const result = await client.getPrompt(options.prompt, options.args);

    const response = JSONFormatter.withMetadata(
      result,
      options.server,
      Date.now() - startTime,
    );
    JSONFormatter.output(response);
  } catch (error) {
    const mcpError = Errors.wrap(error);
    JSONFormatter.output(mcpError.toJSON());
    Deno.exit(1);
  }
}
