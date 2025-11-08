/**
 * Zod schemas for configuration validation
 */

import { z } from 'zod';

const StdioServerConfigSchema = z.object({
  type: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

const SSEServerConfigSchema = z.object({
  type: z.literal('sse'),
  url: z.string().url(),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
});

const HTTPServerConfigSchema = z.object({
  type: z.literal('http'),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

const ServerConfigSchema = z.discriminatedUnion('type', [
  StdioServerConfigSchema,
  SSEServerConfigSchema,
  HTTPServerConfigSchema,
]);

const PreferencesSchema = z.object({
  defaultTimeout: z.number().positive().optional(),
  maxRetries: z.number().nonnegative().optional(),
  logLevel: z.enum(['error', 'warn', 'info', 'debug', 'trace']).optional(),
});

export const ConfigSchema = z.object({
  servers: z.record(ServerConfigSchema),
  preferences: PreferencesSchema.optional(),
});

export type ValidatedConfig = z.infer<typeof ConfigSchema>;
