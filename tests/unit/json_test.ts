import { assertEquals, assertExists } from "@std/assert";
import { JSONFormatter } from "../../src/utils/json.ts";

Deno.test("JSONFormatter - success", () => {
  const response = JSONFormatter.success({ message: "test" });

  assertEquals(response.success, true);
  assertExists(response.data);
  assertEquals(response.data.message, "test");
});

Deno.test("JSONFormatter - success with metadata", () => {
  const response = JSONFormatter.success({ message: "test" }, {
    server: "test-server",
    executionTime: 100,
  });

  assertEquals(response.success, true);
  assertExists(response.metadata);
  assertEquals(response.metadata?.server, "test-server");
  assertEquals(response.metadata?.executionTime, 100);
  assertExists(response.metadata?.timestamp);
});

Deno.test("JSONFormatter - estimateTokens", () => {
  const text = "Hello, world!";
  const tokens = JSONFormatter.estimateTokens(text);

  // Roughly 4 characters per token
  assertEquals(tokens, Math.ceil(text.length / 4));
  assertEquals(tokens > 0, true);
});

Deno.test("JSONFormatter - estimateTokensForObject", () => {
  const obj = { message: "test", value: 123 };
  const tokens = JSONFormatter.estimateTokensForObject(obj);

  assertEquals(tokens > 0, true);
  assertEquals(typeof tokens, "number");
});

Deno.test("JSONFormatter - classifyResultSize", () => {
  assertEquals(JSONFormatter.classifyResultSize(100), "small");
  assertEquals(JSONFormatter.classifyResultSize(1000), "medium");
  assertEquals(JSONFormatter.classifyResultSize(5000), "large");
});

Deno.test("JSONFormatter - truncateToTokens", () => {
  const longText = "a".repeat(1000);

  const result = JSONFormatter.truncateToTokens(longText, 10);

  assertEquals(result.truncated, true);
  assertEquals(result.text.length < longText.length, true);
  assertEquals(result.text.includes("[truncated]"), true);
});

Deno.test("JSONFormatter - truncateToTokens (no truncation needed)", () => {
  const shortText = "short text";

  const result = JSONFormatter.truncateToTokens(shortText, 100);

  assertEquals(result.truncated, false);
  assertEquals(result.text, shortText);
});

Deno.test("JSONFormatter - withMetadata", () => {
  const data = { message: "test" };
  const response = JSONFormatter.withMetadata(data, "test-server", 100);

  assertEquals(response.success, true);
  assertExists(response.metadata);
  assertEquals(response.metadata?.server, "test-server");
  assertEquals(response.metadata?.executionTime, 100);
  assertExists(response.metadata?.tokensEstimate);
  assertExists(response.metadata?.resultSize);
});

Deno.test("JSONFormatter - parse", () => {
  const json = '{"message": "test"}';
  const parsed = JSONFormatter.parse(json);

  assertExists(parsed);
  assertEquals((parsed as { message: string }).message, "test");
});

Deno.test("JSONFormatter - parse invalid JSON", () => {
  let error: Error | null = null;

  try {
    JSONFormatter.parse("invalid json");
  } catch (e) {
    error = e as Error;
  }

  assertExists(error);
  assertEquals(error?.message.includes("Invalid JSON"), true);
});

Deno.test("JSONFormatter - prettyPrint", () => {
  const obj = { message: "test", nested: { value: 123 } };
  const pretty = JSONFormatter.prettyPrint(obj);

  assertEquals(pretty.includes("\n"), true);
  assertEquals(pretty.includes("  "), true);
  assertEquals(pretty.includes("test"), true);
});

Deno.test("JSONFormatter - safeStringify", () => {
  const obj = { message: "test" };
  const json = JSONFormatter.safeStringify(obj);

  assertExists(json);
  assertEquals(json.includes("test"), true);
});

Deno.test("JSONFormatter - safeStringify with circular reference", () => {
  const obj: { message: string; self?: unknown } = { message: "test" };
  obj.self = obj; // Create circular reference

  const json = JSONFormatter.safeStringify(obj);

  assertExists(json);
  assertEquals(json.includes("[Circular]"), true);
});
