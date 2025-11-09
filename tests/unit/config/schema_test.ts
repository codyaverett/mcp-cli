import { assert, assertEquals, assertExists } from "@std/assert";
import { configSchema, preferencesSchema, serverConfigSchema } from "../../../src/config/schema.ts";
import { LogLevel } from "../../../src/types/config.ts";
import type {
  HTTPServerConfig,
  SSEServerConfig,
  StdioServerConfig,
} from "../../../src/types/config.ts";
import { assertThrows } from "../../fixtures/test-utils.ts";

// Stdio Server Config Tests

Deno.test("schema - valid stdio server config minimal", () => {
  const config = {
    type: "stdio" as const,
    command: "test-command",
  };

  const result = serverConfigSchema.parse(config) as StdioServerConfig;

  assertExists(result);
  assertEquals(result.type, "stdio");
  assertEquals(result.command, "test-command");
  assertEquals(result.enabled, true); // default
});

Deno.test("schema - valid stdio server config with all fields", () => {
  const config = {
    type: "stdio" as const,
    command: "test-command",
    args: ["arg1", "arg2"],
    env: { "VAR1": "value1" },
    cwd: "/path/to/dir",
    enabled: false,
    timeout: 5000,
    maxRetries: 3,
  };

  const result = serverConfigSchema.parse(config) as StdioServerConfig;

  assertExists(result);
  assertEquals(result.type, "stdio");
  assertEquals(result.command, "test-command");
  assertEquals(result.args?.length, 2);
  assertEquals(result.env?.VAR1, "value1");
  assertEquals(result.cwd, "/path/to/dir");
  assertEquals(result.enabled, false);
  assertEquals(result.timeout, 5000);
  assertEquals(result.maxRetries, 3);
});

Deno.test("schema - invalid stdio server config empty command", () => {
  const config = {
    type: "stdio" as const,
    command: "",
  };

  assertThrows(() => {
    serverConfigSchema.parse(config);
  });
});

Deno.test("schema - invalid stdio server config missing command", () => {
  const config = {
    type: "stdio" as const,
  };

  assertThrows(() => {
    serverConfigSchema.parse(config);
  });
});

Deno.test("schema - invalid stdio server config negative timeout", () => {
  const config = {
    type: "stdio" as const,
    command: "test",
    timeout: -1,
  };

  assertThrows(() => {
    serverConfigSchema.parse(config);
  });
});

Deno.test("schema - invalid stdio server config zero timeout", () => {
  const config = {
    type: "stdio" as const,
    command: "test",
    timeout: 0,
  };

  assertThrows(() => {
    serverConfigSchema.parse(config);
  });
});

Deno.test("schema - invalid stdio server config negative maxRetries", () => {
  const config = {
    type: "stdio" as const,
    command: "test",
    maxRetries: -1,
  };

  assertThrows(() => {
    serverConfigSchema.parse(config);
  });
});

Deno.test("schema - valid stdio server config zero maxRetries", () => {
  const config = {
    type: "stdio" as const,
    command: "test",
    maxRetries: 0,
  };

  const result = serverConfigSchema.parse(config);

  assertExists(result);
  assertEquals(result.maxRetries, 0);
});

// SSE Server Config Tests

Deno.test("schema - valid SSE server config minimal", () => {
  const config = {
    type: "sse" as const,
    url: "http://localhost:3000",
  };

  const result = serverConfigSchema.parse(config) as SSEServerConfig;

  assertExists(result);
  assertEquals(result.type, "sse");
  assertEquals(result.url, "http://localhost:3000");
  assertEquals(result.enabled, true); // default
});

Deno.test("schema - valid SSE server config with all fields", () => {
  const config = {
    type: "sse" as const,
    url: "https://api.example.com/sse",
    apiKey: "secret-key",
    headers: { "X-Custom": "value" },
    enabled: true,
    timeout: 10000,
    maxRetries: 5,
  };

  const result = serverConfigSchema.parse(config) as SSEServerConfig;

  assertExists(result);
  assertEquals(result.type, "sse");
  assertEquals(result.url, "https://api.example.com/sse");
  assertEquals(result.apiKey, "secret-key");
  assertEquals(result.headers?.["X-Custom"], "value");
  assertEquals(result.enabled, true);
  assertEquals(result.timeout, 10000);
  assertEquals(result.maxRetries, 5);
});

Deno.test("schema - invalid SSE server config missing url", () => {
  const config = {
    type: "sse" as const,
  };

  assertThrows(() => {
    serverConfigSchema.parse(config);
  });
});

Deno.test("schema - invalid SSE server config invalid url", () => {
  const config = {
    type: "sse" as const,
    url: "not-a-url",
  };

  assertThrows(() => {
    serverConfigSchema.parse(config);
  });
});

Deno.test("schema - valid SSE server config with https url", () => {
  const config = {
    type: "sse" as const,
    url: "https://secure.example.com",
  };

  const result = serverConfigSchema.parse(config) as SSEServerConfig;

  assertExists(result);
  assertEquals(result.url, "https://secure.example.com");
});

// HTTP Server Config Tests

Deno.test("schema - valid HTTP server config minimal", () => {
  const config = {
    type: "http" as const,
    url: "http://localhost:3001",
  };

  const result = serverConfigSchema.parse(config) as HTTPServerConfig;

  assertExists(result);
  assertEquals(result.type, "http");
  assertEquals(result.url, "http://localhost:3001");
  assertEquals(result.enabled, true); // default
});

Deno.test("schema - valid HTTP server config with all fields", () => {
  const config = {
    type: "http" as const,
    url: "https://api.example.com/mcp",
    apiKey: "secret-key",
    headers: { "Authorization": "Bearer token" },
    method: "POST" as const,
    enabled: false,
    timeout: 15000,
    maxRetries: 10,
  };

  const result = serverConfigSchema.parse(config) as HTTPServerConfig;

  assertExists(result);
  assertEquals(result.type, "http");
  assertEquals(result.url, "https://api.example.com/mcp");
  assertEquals(result.apiKey, "secret-key");
  assertEquals(result.headers?.Authorization, "Bearer token");
  assertEquals(result.method, "POST");
  assertEquals(result.enabled, false);
  assertEquals(result.timeout, 15000);
  assertEquals(result.maxRetries, 10);
});

Deno.test("schema - valid HTTP server config with GET method", () => {
  const config = {
    type: "http" as const,
    url: "http://localhost:3001",
    method: "GET" as const,
  };

  const result = serverConfigSchema.parse(config) as HTTPServerConfig;

  assertExists(result);
  assertEquals(result.method, "GET");
});

Deno.test("schema - invalid HTTP server config with invalid method", () => {
  const config = {
    type: "http" as const,
    url: "http://localhost:3001",
    method: "PUT",
  };

  assertThrows(() => {
    serverConfigSchema.parse(config);
  });
});

Deno.test("schema - invalid HTTP server config missing url", () => {
  const config = {
    type: "http" as const,
  };

  assertThrows(() => {
    serverConfigSchema.parse(config);
  });
});

// Preferences Schema Tests

Deno.test("schema - valid preferences empty", () => {
  const prefs = {};

  const result = preferencesSchema.parse(prefs);

  assertExists(result);
});

Deno.test("schema - valid preferences with all fields", () => {
  const prefs = {
    defaultTimeout: 30000,
    maxRetries: 5,
    logLevel: LogLevel.DEBUG,
    cacheSchemas: true,
    cacheTTL: 3600,
  };

  const result = preferencesSchema.parse(prefs);

  assertExists(result);
  assertEquals(result.defaultTimeout, 30000);
  assertEquals(result.maxRetries, 5);
  assertEquals(result.logLevel, LogLevel.DEBUG);
  assertEquals(result.cacheSchemas, true);
  assertEquals(result.cacheTTL, 3600);
});

Deno.test("schema - valid preferences with each log level", () => {
  for (
    const level of [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE]
  ) {
    const prefs = { logLevel: level };
    const result = preferencesSchema.parse(prefs);
    assertEquals(result.logLevel, level);
  }
});

Deno.test("schema - invalid preferences negative defaultTimeout", () => {
  const prefs = {
    defaultTimeout: -1,
  };

  assertThrows(() => {
    preferencesSchema.parse(prefs);
  });
});

Deno.test("schema - invalid preferences zero defaultTimeout", () => {
  const prefs = {
    defaultTimeout: 0,
  };

  assertThrows(() => {
    preferencesSchema.parse(prefs);
  });
});

Deno.test("schema - invalid preferences negative maxRetries", () => {
  const prefs = {
    maxRetries: -1,
  };

  assertThrows(() => {
    preferencesSchema.parse(prefs);
  });
});

Deno.test("schema - valid preferences zero maxRetries", () => {
  const prefs = {
    maxRetries: 0,
  };

  const result = preferencesSchema.parse(prefs);
  assertEquals(result.maxRetries, 0);
});

Deno.test("schema - invalid preferences negative cacheTTL", () => {
  const prefs = {
    cacheTTL: -1,
  };

  assertThrows(() => {
    preferencesSchema.parse(prefs);
  });
});

Deno.test("schema - invalid preferences zero cacheTTL", () => {
  const prefs = {
    cacheTTL: 0,
  };

  assertThrows(() => {
    preferencesSchema.parse(prefs);
  });
});

// Complete Config Schema Tests

Deno.test("schema - valid config empty servers", () => {
  const config = {
    servers: {},
  };

  const result = configSchema.parse(config);

  assertExists(result);
  assertEquals(Object.keys(result.servers).length, 0);
});

Deno.test("schema - valid config with multiple servers", () => {
  const config = {
    servers: {
      "server1": {
        type: "stdio" as const,
        command: "test1",
      },
      "server2": {
        type: "sse" as const,
        url: "http://localhost:3000",
      },
      "server3": {
        type: "http" as const,
        url: "http://localhost:3001",
      },
    },
  };

  const result = configSchema.parse(config);

  assertExists(result);
  assertEquals(Object.keys(result.servers).length, 3);
  assert("server1" in result.servers);
  assert("server2" in result.servers);
  assert("server3" in result.servers);
});

Deno.test("schema - valid config with servers and preferences", () => {
  const config = {
    servers: {
      "test": {
        type: "stdio" as const,
        command: "test",
      },
    },
    preferences: {
      defaultTimeout: 5000,
      logLevel: LogLevel.INFO,
    },
  };

  const result = configSchema.parse(config);

  assertExists(result);
  assertExists(result.preferences);
  assertEquals(result.preferences.defaultTimeout, 5000);
  assertEquals(result.preferences.logLevel, LogLevel.INFO);
});

Deno.test("schema - invalid config missing servers", () => {
  const config = {
    preferences: {
      defaultTimeout: 5000,
    },
  };

  assertThrows(() => {
    configSchema.parse(config);
  });
});

Deno.test("schema - invalid config with invalid server", () => {
  const config = {
    servers: {
      "test": {
        type: "invalid-type",
      },
    },
  };

  assertThrows(() => {
    configSchema.parse(config);
  });
});

// Type Coercion Tests

Deno.test("schema - stdio config coerces enabled default", () => {
  const config = {
    type: "stdio" as const,
    command: "test",
  };

  const result = serverConfigSchema.parse(config);

  assertEquals(result.enabled, true);
});

Deno.test("schema - SSE config coerces enabled default", () => {
  const config = {
    type: "sse" as const,
    url: "http://localhost:3000",
  };

  const result = serverConfigSchema.parse(config);

  assertEquals(result.enabled, true);
});

Deno.test("schema - HTTP config coerces enabled default", () => {
  const config = {
    type: "http" as const,
    url: "http://localhost:3001",
  };

  const result = serverConfigSchema.parse(config);

  assertEquals(result.enabled, true);
});

// Edge Cases

Deno.test("schema - stdio config with empty args array", () => {
  const config = {
    type: "stdio" as const,
    command: "test",
    args: [],
  };

  const result = serverConfigSchema.parse(config) as StdioServerConfig;

  assertExists(result);
  assertEquals(result.args?.length, 0);
});

Deno.test("schema - stdio config with empty env object", () => {
  const config = {
    type: "stdio" as const,
    command: "test",
    env: {},
  };

  const result = serverConfigSchema.parse(config) as StdioServerConfig;

  assertExists(result);
  assertEquals(Object.keys(result.env || {}).length, 0);
});

Deno.test("schema - SSE config with empty headers object", () => {
  const config = {
    type: "sse" as const,
    url: "http://localhost:3000",
    headers: {},
  };

  const result = serverConfigSchema.parse(config) as SSEServerConfig;

  assertExists(result);
  assertEquals(Object.keys(result.headers || {}).length, 0);
});

Deno.test("schema - HTTP config with empty headers object", () => {
  const config = {
    type: "http" as const,
    url: "http://localhost:3001",
    headers: {},
  };

  const result = serverConfigSchema.parse(config) as HTTPServerConfig;

  assertExists(result);
  assertEquals(Object.keys(result.headers || {}).length, 0);
});

Deno.test("schema - config with many servers", () => {
  const servers: Record<string, { type: "stdio"; command: string }> = {};
  for (let i = 0; i < 100; i++) {
    servers[`server-${i}`] = {
      type: "stdio",
      command: `test-${i}`,
    };
  }

  const config = { servers };
  const result = configSchema.parse(config);

  assertEquals(Object.keys(result.servers).length, 100);
});

Deno.test("schema - discriminated union correctly identifies stdio", () => {
  const config = {
    type: "stdio" as const,
    command: "test",
  };

  const result = serverConfigSchema.parse(config);

  assertEquals(result.type, "stdio");
  assert("command" in result);
});

Deno.test("schema - discriminated union correctly identifies sse", () => {
  const config = {
    type: "sse" as const,
    url: "http://localhost:3000",
  };

  const result = serverConfigSchema.parse(config);

  assertEquals(result.type, "sse");
  assert("url" in result);
});

Deno.test("schema - discriminated union correctly identifies http", () => {
  const config = {
    type: "http" as const,
    url: "http://localhost:3001",
  };

  const result = serverConfigSchema.parse(config);

  assertEquals(result.type, "http");
  assert("url" in result);
});
