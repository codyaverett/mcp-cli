import { assertEquals, assertExists } from "@std/assert";
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
