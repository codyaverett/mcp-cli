/**
 * Configuration file loader with validation
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ConfigSchema } from './schema.js';
import type { Config, ServerConfig } from '../types/config.js';

const CONFIG_DIR = join(homedir(), '.mcp-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Substitute environment variables in configuration
 */
function substituteEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, varName) => {
      return process.env[varName] || '';
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVars);
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }

  return obj;
}

/**
 * Load and validate configuration file
 */
export async function loadConfig(): Promise<Config> {
  if (!existsSync(CONFIG_FILE)) {
    // Return default empty config
    return {
      servers: {},
      preferences: {},
    };
  }

  const content = await readFile(CONFIG_FILE, 'utf-8');
  const raw = JSON.parse(content);

  // Substitute environment variables
  const withEnv = substituteEnvVars(raw);

  // Validate against schema
  const validated = ConfigSchema.parse(withEnv);

  return validated;
}

/**
 * Save configuration file
 */
export async function saveConfig(config: Config): Promise<void> {
  // Ensure directory exists
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }

  // Validate before saving
  ConfigSchema.parse(config);

  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Add a server to the configuration
 */
export async function addServer(name: string, serverConfig: ServerConfig): Promise<void> {
  const config = await loadConfig();
  config.servers[name] = serverConfig;
  await saveConfig(config);
}

/**
 * Remove a server from the configuration
 */
export async function removeServer(name: string): Promise<void> {
  const config = await loadConfig();
  delete config.servers[name];
  await saveConfig(config);
}

/**
 * Get a specific server configuration
 */
export async function getServerConfig(name: string): Promise<ServerConfig | undefined> {
  const config = await loadConfig();
  return config.servers[name];
}

/**
 * List all configured servers
 */
export async function listServers(): Promise<Record<string, ServerConfig>> {
  const config = await loadConfig();
  return config.servers;
}

/**
 * Get configuration file path
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}
