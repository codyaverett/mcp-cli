import { assertEquals, assertExists } from "@std/assert";
import { Errors } from "../../src/utils/errors.ts";
import { ErrorCode, MCPError } from "../../src/types/errors.ts";

Deno.test("Errors - configNotFound", () => {
  const error = Errors.configNotFound("/path/to/config");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.CONFIG_NOT_FOUND);
  assertEquals(error.message.includes("/path/to/config"), true);
  assertExists(error.suggestion);
});

Deno.test("Errors - configParseError", () => {
  const cause = new Error("Parse failed");
  const error = Errors.configParseError("/path/to/config", cause);

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.CONFIG_PARSE_ERROR);
  assertEquals(error.cause, cause);
});

Deno.test("Errors - serverNotFound with available servers", () => {
  const error = Errors.serverNotFound("test-server", ["server1", "server2"]);

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.SERVER_NOT_FOUND);
  assertEquals(error.message.includes("test-server"), true);
  assertExists(error.similar);
  assertEquals(error.similar?.length, 2);
  assertExists(error.suggestion);
  assertEquals(error.suggestion?.includes("Available servers:"), true);
  assertEquals(error.suggestion?.includes("server1"), true);
  assertEquals(error.suggestion?.includes("server2"), true);
});

Deno.test("Errors - serverNotFound with no servers configured", () => {
  const error = Errors.serverNotFound("test-server", []);

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.SERVER_NOT_FOUND);
  assertEquals(error.message.includes("test-server"), true);
  assertExists(error.suggestion);
  assertEquals(error.suggestion?.includes("No servers configured"), true);
  assertEquals(error.suggestion?.includes("mcp servers init"), true);
  assertEquals(error.suggestion?.includes("mcp servers add"), true);
});

Deno.test("Errors - serverNotFound with undefined servers list", () => {
  const error = Errors.serverNotFound("test-server");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.SERVER_NOT_FOUND);
  assertExists(error.suggestion);
  assertEquals(error.suggestion?.includes("No servers configured"), true);
});

Deno.test("Errors - serverAlreadyExists", () => {
  const error = Errors.serverAlreadyExists("test-server");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.SERVER_ALREADY_EXISTS);
  assertEquals(error.message.includes("test-server"), true);
});

Deno.test("Errors - serverConnectionFailed", () => {
  const error = Errors.serverConnectionFailed("test-server", "Connection refused");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.SERVER_CONNECTION_FAILED);
  assertEquals(error.message.includes("test-server"), true);
  assertEquals(error.message.includes("Connection refused"), true);
});

Deno.test("Errors - serverTimeout", () => {
  const error = Errors.serverTimeout("test-server", 5000);

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.SERVER_TIMEOUT);
  assertEquals(error.message.includes("5000"), true);
});

Deno.test("Errors - serverDisabled", () => {
  const error = Errors.serverDisabled("test-server");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.SERVER_DISABLED);
});

Deno.test("Errors - toolNotFound", () => {
  const error = Errors.toolNotFound("test-tool", "test-server", [
    "tool1",
    "tool2",
    "test-tool-extra",
  ]);

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.TOOL_NOT_FOUND);
  assertExists(error.similar);
  assertEquals(error.similar!.length > 0, true);
});

Deno.test("Errors - toolExecutionFailed", () => {
  const error = Errors.toolExecutionFailed("test-tool", "test-server", "Execution error");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.TOOL_EXECUTION_FAILED);
  assertEquals(error.message.includes("test-tool"), true);
});

Deno.test("Errors - toolInvalidArgs", () => {
  const error = Errors.toolInvalidArgs("test-tool", "test-server", "Missing required field");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.TOOL_INVALID_ARGS);
  assertEquals(error.message.includes("Missing required field"), true);
  assertExists(error.suggestion);
});

Deno.test("Errors - resourceNotFound", () => {
  const error = Errors.resourceNotFound("file:///test", "test-server");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.RESOURCE_NOT_FOUND);
});

Deno.test("Errors - promptNotFound", () => {
  const error = Errors.promptNotFound("test-prompt", "test-server", ["prompt1", "prompt2"]);

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.PROMPT_NOT_FOUND);
  assertExists(error.similar);
});

Deno.test("Errors - validationError", () => {
  const error = Errors.validationError("Validation failed", { field: "value" });

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.VALIDATION_ERROR);
  assertExists(error.details);
});

Deno.test("Errors - invalidJSON", () => {
  const error = Errors.invalidJSON("invalid json");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.INVALID_JSON);
  assertExists(error.suggestion);
});

Deno.test("Errors - transportNotSupported", () => {
  const error = Errors.transportNotSupported("grpc");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.TRANSPORT_NOT_SUPPORTED);
  assertEquals(error.message.includes("grpc"), true);
});

Deno.test("Errors - permissionDenied", () => {
  const error = Errors.permissionDenied("/path/to/file", "read");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.PERMISSION_DENIED);
});

Deno.test("Errors - unknown", () => {
  const error = Errors.unknown("Unknown error occurred");

  assertEquals(error instanceof MCPError, true);
  assertEquals(error.code, ErrorCode.UNKNOWN_ERROR);
});

Deno.test("Errors - wrap MCPError", () => {
  const original = Errors.serverNotFound("test");
  const wrapped = Errors.wrap(original);

  assertEquals(wrapped, original);
});

Deno.test("Errors - wrap Error", () => {
  const original = new Error("Test error");
  const wrapped = Errors.wrap(original);

  assertEquals(wrapped instanceof MCPError, true);
  assertEquals(wrapped.code, ErrorCode.UNKNOWN_ERROR);
  assertEquals(wrapped.cause, original);
});

Deno.test("Errors - wrap unknown", () => {
  const wrapped = Errors.wrap("string error");

  assertEquals(wrapped instanceof MCPError, true);
  assertEquals(wrapped.code, ErrorCode.UNKNOWN_ERROR);
});

Deno.test("MCPError - toJSON", () => {
  const error = new MCPError({
    code: ErrorCode.TOOL_NOT_FOUND,
    message: "Tool not found",
    suggestion: "Try this",
    similar: ["similar1"],
  });

  const json = error.toJSON();

  assertEquals(json.success, false);
  assertExists(json.error);
  assertEquals(json.error.code, ErrorCode.TOOL_NOT_FOUND);
  assertEquals(json.error.message, "Tool not found");
  assertEquals(json.error.suggestion, "Try this");
  assertEquals(json.error.similar?.length, 1);
});
