import { z } from "zod";
import { LogLevel } from "../types/config.ts";

/**
 * Zod schemas for configuration validation
 */

// Base server config schema
const baseServerConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  timeout: z.number().positive().optional(),
  maxRetries: z.number().min(0).optional(),
});

// Stdio transport schema
const stdioServerConfigSchema = baseServerConfigSchema.extend({
  type: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
});

// SSE transport schema
const sseServerConfigSchema = baseServerConfigSchema.extend({
  type: z.literal("sse"),
  url: z.string().url(),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
});

// HTTP transport schema
const httpServerConfigSchema = baseServerConfigSchema.extend({
  type: z.literal("http"),
  url: z.string().url(),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
  method: z.enum(["GET", "POST"]).optional(),
});

// Union of all server config types
export const serverConfigSchema = z.discriminatedUnion("type", [
  stdioServerConfigSchema,
  sseServerConfigSchema,
  httpServerConfigSchema,
]);

// Preferences schema
export const preferencesSchema = z.object({
  defaultTimeout: z.number().positive().optional(),
  maxRetries: z.number().min(0).optional(),
  logLevel: z.nativeEnum(LogLevel).optional(),
  cacheSchemas: z.boolean().optional(),
  cacheTTL: z.number().positive().optional(),
});

// Complete config schema
export const configSchema = z.object({
  servers: z.record(serverConfigSchema),
  preferences: preferencesSchema.optional(),
});

/**
 * Type inference from schemas
 */
export type ConfigSchema = z.infer<typeof configSchema>;
export type ServerConfigSchema = z.infer<typeof serverConfigSchema>;
export type PreferencesSchema = z.infer<typeof preferencesSchema>;
