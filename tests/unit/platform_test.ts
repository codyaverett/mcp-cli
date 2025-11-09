import { assertEquals, assertExists } from "@std/assert";
import { resolve } from "@std/path";
import { Platform } from "../../src/utils/platform.ts";

Deno.test("Platform - getConfigDir", () => {
  const configDir = Platform.getConfigDir();
  assertExists(configDir);
  assertEquals(configDir.includes(".mcp-cli"), true);
});

Deno.test("Platform - getConfigPath", () => {
  const configPath = Platform.getConfigPath();
  assertExists(configPath);
  assertEquals(configPath.includes("config.json"), true);
});

Deno.test("Platform - expandHome", () => {
  const expanded = Platform.expandHome("~/test/path");

  assertEquals(expanded.startsWith("~"), false);
  assertEquals(expanded.includes("test/path"), true);

  // Non-home paths should be unchanged
  const regular = Platform.expandHome("/absolute/path");
  assertEquals(regular, "/absolute/path");
});

Deno.test("Platform - normalizePath", () => {
  const normalized = Platform.normalizePath("~/test/../path");
  assertEquals(normalized.startsWith("~"), false);
  assertEquals(normalized.includes(".."), false);
});

Deno.test("Platform - platform detection", () => {
  const isWindows = Platform.isWindows();
  const isMacOS = Platform.isMacOS();
  const isLinux = Platform.isLinux();

  // Exactly one should be true
  const trueCount = [isWindows, isMacOS, isLinux].filter((v) => v).length;
  assertEquals(trueCount, 1);
});

Deno.test("Platform - getPlatform", () => {
  const platform = Platform.getPlatform();
  assertExists(platform);
  assertEquals(["windows", "darwin", "linux"].includes(platform), true);
});

Deno.test("Platform - getArch", () => {
  const arch = Platform.getArch();
  assertExists(arch);
});

Deno.test("Platform - ensureDir", async () => {
  const testDir = "./tests/fixtures/test-dir";

  await Platform.ensureDir(testDir);

  const exists = await Platform.dirExists(testDir);
  assertEquals(exists, true);

  // Cleanup
  await Deno.remove(testDir);
});

Deno.test("Platform - fileExists", async () => {
  const testFile = "./tests/fixtures/test-file.txt";

  // Create test file
  await Deno.writeTextFile(testFile, "test");

  const exists = await Platform.fileExists(testFile);
  assertEquals(exists, true);

  const notExists = await Platform.fileExists("./nonexistent.txt");
  assertEquals(notExists, false);

  // Cleanup
  await Deno.remove(testFile);
});

Deno.test("Platform - dirExists", async () => {
  const exists = await Platform.dirExists("./tests");
  assertEquals(exists, true);

  const notExists = await Platform.dirExists("./nonexistent-dir");
  assertEquals(notExists, false);
});

Deno.test("Platform - getCurrentDir", () => {
  const cwd = Platform.getCurrentDir();
  assertExists(cwd);
  assertEquals(cwd.length > 0, true);
});

Deno.test("Platform - findConfigFile finds config in current directory", async () => {
  const testConfig = ".mcp-cli.json";
  const testDir = "./tests/fixtures/config-test";

  // Create test directory and config
  await Platform.ensureDir(testDir);
  await Deno.writeTextFile(`${testDir}/${testConfig}`, "{}");

  const found = await Platform.findConfigFile(testDir);
  const expected = resolve(`${testDir}/${testConfig}`);
  assertEquals(found, expected);

  // Cleanup
  await Deno.remove(`${testDir}/${testConfig}`);
  await Deno.remove(testDir);
});

Deno.test("Platform - findConfigFile walks up directory tree", async () => {
  const testConfig = ".mcp-cli.json";
  const parentDir = "./tests/fixtures/config-parent";
  const childDir = `${parentDir}/child/nested`;

  // Create nested directory structure
  await Platform.ensureDir(childDir);
  await Deno.writeTextFile(`${parentDir}/${testConfig}`, "{}");

  // Search from child directory should find parent config
  const found = await Platform.findConfigFile(childDir);
  const expected = resolve(`${parentDir}/${testConfig}`);
  assertEquals(found, expected);

  // Cleanup
  await Deno.remove(`${parentDir}/${testConfig}`);
  await Deno.remove(childDir, { recursive: true });
  await Deno.remove(parentDir, { recursive: true });
});

Deno.test("Platform - findConfigFile returns null when not found", async () => {
  const testDir = "./tests/fixtures/no-config";
  await Platform.ensureDir(testDir);

  const found = await Platform.findConfigFile(testDir);
  assertEquals(found, null);

  // Cleanup
  await Deno.remove(testDir);
});

Deno.test("Platform - resolveConfigPath uses explicit path when provided", async () => {
  const explicitPath = "./custom-config.json";
  const resolved = await Platform.resolveConfigPath(explicitPath);
  assertEquals(resolved.includes("custom-config.json"), true);
});

Deno.test("Platform - resolveConfigPath prefers local config over global", async () => {
  const testConfig = ".mcp-cli.json";

  // Create local config in current directory
  await Deno.writeTextFile(testConfig, "{}");

  const resolved = await Platform.resolveConfigPath();
  assertEquals(resolved.endsWith(testConfig), true);

  // Cleanup
  await Deno.remove(testConfig);
});

Deno.test("Platform - resolveConfigPath falls back to global config", async () => {
  // When no local config exists, should return global config path
  const resolved = await Platform.resolveConfigPath();
  assertEquals(resolved.includes(".mcp-cli"), true);
  assertEquals(resolved.includes("config.json"), true);
});
