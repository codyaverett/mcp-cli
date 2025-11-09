import { assertEquals, assertExists } from "@std/assert";
import type { ServerConfig } from "../../src/types/config.ts";
import type { MCPClientAdapter } from "../../src/client/base.ts";

/**
 * Create a temporary config file path for testing
 */
export function createTempConfigPath(testName: string): string {
  return `./tests/fixtures/temp-config-${testName}-${Date.now()}.json`;
}

/**
 * Clean up a temporary config file
 */
export async function cleanupTempConfig(path: string): Promise<void> {
  try {
    await Deno.remove(path);
  } catch {
    // Ignore errors if file doesn't exist
  }
}

/**
 * Create a temporary directory for testing
 */
export async function createTempDir(prefix: string): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix });
  return dir;
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(path: string): Promise<void> {
  try {
    await Deno.remove(path, { recursive: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }
}

/**
 * Assert that an operation throws an error with a specific message
 */
export async function assertThrowsAsync(
  fn: () => Promise<unknown>,
  expectedMessage?: string | RegExp,
): Promise<void> {
  let error: Error | null = null;
  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  assertExists(error, "Expected function to throw an error");

  if (expectedMessage) {
    if (typeof expectedMessage === "string") {
      assertEquals(
        error.message.includes(expectedMessage),
        true,
        `Expected error message to contain "${expectedMessage}", got "${error.message}"`,
      );
    } else {
      assertEquals(
        expectedMessage.test(error.message),
        true,
        `Expected error message to match ${expectedMessage}, got "${error.message}"`,
      );
    }
  }
}

/**
 * Assert that an operation throws an error
 */
export function assertThrows(fn: () => void, expectedMessage?: string | RegExp): void {
  let error: Error | null = null;
  try {
    fn();
  } catch (e) {
    error = e as Error;
  }

  assertExists(error, "Expected function to throw an error");

  if (expectedMessage) {
    if (typeof expectedMessage === "string") {
      assertEquals(
        error.message.includes(expectedMessage),
        true,
        `Expected error message to contain "${expectedMessage}", got "${error.message}"`,
      );
    } else {
      assertEquals(
        expectedMessage.test(error.message),
        true,
        `Expected error message to match ${expectedMessage}, got "${error.message}"`,
      );
    }
  }
}

/**
 * Wait for a condition to become true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a mock server config for testing
 */
export function createMockServerConfig(
  name: string,
  type: "stdio" | "sse" | "http" = "stdio",
): ServerConfig {
  switch (type) {
    case "stdio":
      return {
        type: "stdio",
        command: "mock-server",
        args: ["--test"],
        enabled: true,
      };
    case "sse":
      return {
        type: "sse",
        url: `http://localhost:3000/${name}`,
        enabled: true,
      };
    case "http":
      return {
        type: "http",
        url: `http://localhost:3001/${name}`,
        enabled: true,
      };
  }
}

/**
 * Assert that a client is in the expected state
 */
export function assertClientState(
  client: MCPClientAdapter,
  expectedConnected: boolean,
): void {
  assertEquals(
    client.isConnected(),
    expectedConnected,
    `Expected client to be ${expectedConnected ? "connected" : "disconnected"}`,
  );
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
  const startTime = performance.now();
  const result = await fn();
  const time = performance.now() - startTime;
  return { result, time };
}

/**
 * Assert that an operation completes within a time limit
 */
export async function assertCompletesWithin<T>(
  fn: () => Promise<T>,
  maxTime: number,
): Promise<T> {
  const { result, time } = await measureTime(fn);
  if (time > maxTime) {
    throw new Error(`Operation took ${time}ms, expected less than ${maxTime}ms`);
  }
  return result;
}

/**
 * Assert that an operation takes at least a minimum time
 */
export async function assertTakesAtLeast<T>(
  fn: () => Promise<T>,
  minTime: number,
): Promise<T> {
  const { result, time } = await measureTime(fn);
  if (time < minTime) {
    throw new Error(`Operation took ${time}ms, expected at least ${minTime}ms`);
  }
  return result;
}

/**
 * Create a spy function that tracks calls
 */
export interface SpyFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T>;
  calls: Parameters<T>[];
  callCount: number;
  reset: () => void;
}

export function createSpy<T extends (...args: unknown[]) => unknown>(
  implementation?: T,
): SpyFunction<T> {
  const calls: Parameters<T>[] = [];

  const spy = ((...args: Parameters<T>) => {
    calls.push(args);
    return implementation?.(...args);
  }) as SpyFunction<T>;

  Object.defineProperty(spy, "calls", {
    get: () => calls,
  });

  Object.defineProperty(spy, "callCount", {
    get: () => calls.length,
  });

  spy.reset = () => {
    calls.length = 0;
  };

  return spy;
}

/**
 * Suppress console output during test execution
 */
export function withSuppressedConsole<T>(fn: () => T): T {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};

  try {
    return fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }
}

/**
 * Suppress console output during async test execution
 */
export async function withSuppressedConsoleAsync<T>(fn: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};

  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }
}
