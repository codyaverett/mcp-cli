import { assertEquals, assertExists } from "@std/assert";
import { getPrompt, getPromptSchema, listPrompts } from "../../../src/commands/prompts.ts";
import { clientPool } from "../../../src/client/factory.ts";
import { JSONFormatter } from "../../../src/utils/json.ts";
import { MockMCPClient } from "../../fixtures/mock-client.ts";
import { createPrompt, createPromptResult, SAMPLE_PROMPTS } from "../../fixtures/test-data.ts";
import type { StdioServerConfig } from "../../../src/types/config.ts";

// Store original functions
const originalOutput = JSONFormatter.output;
const originalExit = Deno.exit;

// Captured output
let capturedOutput: unknown[] = [];
let exitCode: number | null = null;

// Mock JSONFormatter.output
function mockOutput() {
  capturedOutput = [];
  JSONFormatter.output = (data: unknown) => {
    capturedOutput.push(data);
  };
}

// Mock Deno.exit
function mockExit() {
  exitCode = null;
  Deno.exit = ((code?: number) => {
    exitCode = code ?? 0;
  }) as typeof Deno.exit;
}

// Restore original functions
function restoreMocks() {
  JSONFormatter.output = originalOutput;
  Deno.exit = originalExit;
  capturedOutput = [];
  exitCode = null;
}

// Setup/teardown
function setup() {
  mockOutput();
  mockExit();
}

function teardown() {
  restoreMocks();
  const servers = clientPool.getConfiguredServers();
  servers.forEach((name) => clientPool.removeServer(name));
}

Deno.test("listPrompts - names only mode", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setPrompts(SAMPLE_PROMPTS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await listPrompts("test-server", { namesOnly: true });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: string[] };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);
    assertEquals(output.data.length, 2);
    assertEquals(output.data.includes("simple_prompt"), true);
    assertEquals(output.data.includes("complex_prompt"), true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("listPrompts - full mode", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setPrompts(SAMPLE_PROMPTS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await listPrompts("test-server", {});

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: unknown[] };
    assertExists(output.data);
    assertEquals(Array.isArray(output.data), true);
    assertEquals(output.data.length, 2);

    // Full mode includes descriptions and arguments
    const firstPrompt = output.data[0] as { name: string; description?: string };
    assertExists(firstPrompt.name);
    assertEquals("description" in firstPrompt, true);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("listPrompts - handles error", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setErrorOnOperation("listPrompts");

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await listPrompts("test-server", { namesOnly: true });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getPromptSchema - success", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setPrompts(SAMPLE_PROMPTS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getPromptSchema("test-server", "simple_prompt");

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { name: string } };
    assertExists(output.data);
    assertEquals(output.data.name, "simple_prompt");

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getPromptSchema - prompt not found", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setPrompts(SAMPLE_PROMPTS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getPromptSchema("test-server", "nonexistent_prompt");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getPromptSchema - handles error", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setErrorOnOperation("listPrompts");

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getPromptSchema("test-server", "simple_prompt");

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getPrompt - success without args", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setPrompts(SAMPLE_PROMPTS);
    const promptResult = createPromptResult("User message", "Assistant message");
    mockClient.setPromptResult("simple_prompt", promptResult);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getPrompt({
      server: "test-server",
      prompt: "simple_prompt",
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { messages: unknown[] } };
    assertExists(output.data);
    assertExists(output.data.messages);
    assertEquals(output.data.messages.length, 2);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getPrompt - success with args", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setPrompts(SAMPLE_PROMPTS);
    const promptResult = createPromptResult("User message with args", "Assistant response");
    mockClient.setPromptResult("complex_prompt", promptResult);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getPrompt({
      server: "test-server",
      prompt: "complex_prompt",
      args: { topic: "AI", style: "formal" },
    });

    assertEquals(capturedOutput.length, 1);
    const output = capturedOutput[0] as { data: { messages: unknown[] } };
    assertExists(output.data);
    assertExists(output.data.messages);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getPrompt - prompt not found", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setPrompts(SAMPLE_PROMPTS);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getPrompt({
      server: "test-server",
      prompt: "nonexistent_prompt",
    });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getPrompt - handles execution error", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setPrompts(SAMPLE_PROMPTS);
    mockClient.setErrorOnOperation("getPrompt");

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getPrompt({
      server: "test-server",
      prompt: "simple_prompt",
    });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});

Deno.test("getPrompt - validates prompt exists before execution", async () => {
  setup();

  try {
    const mockClient = new MockMCPClient();
    mockClient.setPrompts([createPrompt("existing_prompt", "An existing prompt")]);

    const config: StdioServerConfig = {
      type: "stdio",
      command: "test",
      enabled: true,
    };

    clientPool.addServer("test-server", config);

    const originalGetClient = clientPool.getClient.bind(clientPool);
    clientPool.getClient = async () => mockClient;

    await mockClient.connect();

    await getPrompt({
      server: "test-server",
      prompt: "nonexistent_prompt",
    });

    assertEquals(capturedOutput.length, 1);
    assertEquals(exitCode, 1);
    const output = capturedOutput[0] as { error: unknown };
    assertExists(output.error);

    clientPool.getClient = originalGetClient;
  } finally {
    teardown();
  }
});
