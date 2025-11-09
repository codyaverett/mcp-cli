import { assertEquals, assertExists } from "@std/assert";
import { Logger } from "../../../src/utils/logger.ts";
import { LogLevel } from "../../../src/types/config.ts";

/**
 * Helper to capture stderr output
 */
function captureStderr(fn: () => void): string {
  const originalError = console.error;
  const output: string[] = [];

  console.error = (...args: unknown[]) => {
    output.push(args.map(String).join(" "));
  };

  try {
    fn();
    return output.join("\n");
  } finally {
    console.error = originalError;
  }
}

Deno.test("Logger - singleton pattern", () => {
  const logger1 = Logger.getInstance();
  const logger2 = Logger.getInstance();

  assertEquals(logger1, logger2);
  assertExists(logger1);
});

Deno.test("Logger - default log level is INFO", () => {
  const logger = Logger.getInstance();
  assertEquals(logger.getLevel(), LogLevel.INFO);
});

Deno.test("Logger - setLevel changes log level", () => {
  const logger = Logger.getInstance();

  logger.setLevel(LogLevel.DEBUG);
  assertEquals(logger.getLevel(), LogLevel.DEBUG);

  logger.setLevel(LogLevel.ERROR);
  assertEquals(logger.getLevel(), LogLevel.ERROR);

  logger.setLevel(LogLevel.TRACE);
  assertEquals(logger.getLevel(), LogLevel.TRACE);

  // Reset to default
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - error logs at ERROR level", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.ERROR);

  const output = captureStderr(() => {
    logger.error("Test error message");
  });

  assertEquals(output.includes("[ERROR]"), true);
  assertEquals(output.includes("Test error message"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - warn logs at WARN level", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.WARN);

  const output = captureStderr(() => {
    logger.warn("Test warning message");
  });

  assertEquals(output.includes("[WARN]"), true);
  assertEquals(output.includes("Test warning message"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - info logs at INFO level", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const output = captureStderr(() => {
    logger.info("Test info message");
  });

  assertEquals(output.includes("[INFO]"), true);
  assertEquals(output.includes("Test info message"), true);
});

Deno.test("Logger - debug logs at DEBUG level", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.DEBUG);

  const output = captureStderr(() => {
    logger.debug("Test debug message");
  });

  assertEquals(output.includes("[DEBUG]"), true);
  assertEquals(output.includes("Test debug message"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - trace logs at TRACE level", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.TRACE);

  const output = captureStderr(() => {
    logger.trace("Test trace message");
  });

  assertEquals(output.includes("[TRACE]"), true);
  assertEquals(output.includes("Test trace message"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - logs include timestamp", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const output = captureStderr(() => {
    logger.info("Test message");
  });

  // Check for ISO timestamp format
  assertEquals(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/.test(output), true);
});

Deno.test("Logger - logs with metadata", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const output = captureStderr(() => {
    logger.info("Test message", { key: "value", number: 42 });
  });

  assertEquals(output.includes("Test message"), true);
  assertEquals(output.includes("key"), true);
  assertEquals(output.includes("value"), true);
  assertEquals(output.includes("number"), true);
  assertEquals(output.includes("42"), true);
});

Deno.test("Logger - metadata is formatted with indentation", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const output = captureStderr(() => {
    logger.info("Test message", { nested: { key: "value" } });
  });

  // Should have indentation
  assertEquals(output.includes("  "), true);
});

Deno.test("Logger - empty metadata is not logged", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const output = captureStderr(() => {
    logger.info("Test message", {});
  });

  assertEquals(output.includes("Test message"), true);
  // Should not have extra JSON formatting for empty object
  assertEquals(output.split("\n").length, 1);
});

Deno.test("Logger - log level filtering ERROR", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.ERROR);

  const output = captureStderr(() => {
    logger.error("Should log");
    logger.warn("Should not log");
    logger.info("Should not log");
    logger.debug("Should not log");
    logger.trace("Should not log");
  });

  assertEquals(output.includes("Should log"), true);
  assertEquals(output.includes("Should not log"), false);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - log level filtering WARN", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.WARN);

  const output = captureStderr(() => {
    logger.error("Error should log");
    logger.warn("Warn should log");
    logger.info("Info should not log");
    logger.debug("Debug should not log");
    logger.trace("Trace should not log");
  });

  assertEquals(output.includes("Error should log"), true);
  assertEquals(output.includes("Warn should log"), true);
  assertEquals(output.includes("Info should not log"), false);
  assertEquals(output.includes("Debug should not log"), false);
  assertEquals(output.includes("Trace should not log"), false);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - log level filtering INFO", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const output = captureStderr(() => {
    logger.error("Error should log");
    logger.warn("Warn should log");
    logger.info("Info should log");
    logger.debug("Debug should not log");
    logger.trace("Trace should not log");
  });

  assertEquals(output.includes("Error should log"), true);
  assertEquals(output.includes("Warn should log"), true);
  assertEquals(output.includes("Info should log"), true);
  assertEquals(output.includes("Debug should not log"), false);
  assertEquals(output.includes("Trace should not log"), false);
});

Deno.test("Logger - log level filtering DEBUG", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.DEBUG);

  const output = captureStderr(() => {
    logger.error("Error should log");
    logger.warn("Warn should log");
    logger.info("Info should log");
    logger.debug("Debug should log");
    logger.trace("Trace should not log");
  });

  assertEquals(output.includes("Error should log"), true);
  assertEquals(output.includes("Warn should log"), true);
  assertEquals(output.includes("Info should log"), true);
  assertEquals(output.includes("Debug should log"), true);
  assertEquals(output.includes("Trace should not log"), false);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - log level filtering TRACE", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.TRACE);

  const output = captureStderr(() => {
    logger.error("Error should log");
    logger.warn("Warn should log");
    logger.info("Info should log");
    logger.debug("Debug should log");
    logger.trace("Trace should log");
  });

  assertEquals(output.includes("Error should log"), true);
  assertEquals(output.includes("Warn should log"), true);
  assertEquals(output.includes("Info should log"), true);
  assertEquals(output.includes("Debug should log"), true);
  assertEquals(output.includes("Trace should log"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - child logger includes context", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const childLogger = logger.child({ component: "test-component" });

  const output = captureStderr(() => {
    childLogger.info("Test message");
  });

  assertEquals(output.includes("Test message"), true);
  assertEquals(output.includes("component"), true);
  assertEquals(output.includes("test-component"), true);
});

Deno.test("Logger - child logger merges context with metadata", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const childLogger = logger.child({ component: "test-component" });

  const output = captureStderr(() => {
    childLogger.info("Test message", { action: "testing" });
  });

  assertEquals(output.includes("Test message"), true);
  assertEquals(output.includes("component"), true);
  assertEquals(output.includes("test-component"), true);
  assertEquals(output.includes("action"), true);
  assertEquals(output.includes("testing"), true);
});

Deno.test("Logger - child logger metadata overrides context", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const childLogger = logger.child({ key: "original" });

  const output = captureStderr(() => {
    childLogger.info("Test message", { key: "override" });
  });

  assertEquals(output.includes("Test message"), true);
  assertEquals(output.includes("override"), true);
  assertEquals(output.includes("original"), false);
});

Deno.test("Logger - child logger error method", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.ERROR);

  const childLogger = logger.child({ component: "test" });

  const output = captureStderr(() => {
    childLogger.error("Error message");
  });

  assertEquals(output.includes("[ERROR]"), true);
  assertEquals(output.includes("Error message"), true);
  assertEquals(output.includes("component"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - child logger warn method", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.WARN);

  const childLogger = logger.child({ component: "test" });

  const output = captureStderr(() => {
    childLogger.warn("Warning message");
  });

  assertEquals(output.includes("[WARN]"), true);
  assertEquals(output.includes("Warning message"), true);
  assertEquals(output.includes("component"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - child logger debug method", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.DEBUG);

  const childLogger = logger.child({ component: "test" });

  const output = captureStderr(() => {
    childLogger.debug("Debug message");
  });

  assertEquals(output.includes("[DEBUG]"), true);
  assertEquals(output.includes("Debug message"), true);
  assertEquals(output.includes("component"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - child logger trace method", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.TRACE);

  const childLogger = logger.child({ component: "test" });

  const output = captureStderr(() => {
    childLogger.trace("Trace message");
  });

  assertEquals(output.includes("[TRACE]"), true);
  assertEquals(output.includes("Trace message"), true);
  assertEquals(output.includes("component"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});

Deno.test("Logger - multiple child loggers are independent", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const child1 = logger.child({ component: "component1" });
  const child2 = logger.child({ component: "component2" });

  const output = captureStderr(() => {
    child1.info("Message 1");
    child2.info("Message 2");
  });

  assertEquals(output.includes("Message 1"), true);
  assertEquals(output.includes("component1"), true);
  assertEquals(output.includes("Message 2"), true);
  assertEquals(output.includes("component2"), true);
});

Deno.test("Logger - handles special characters in messages", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const output = captureStderr(() => {
    logger.info("Message with \"quotes\" and \nnewlines");
  });

  assertEquals(output.includes("quotes"), true);
});

Deno.test("Logger - handles complex metadata objects", () => {
  const logger = Logger.getInstance();
  logger.setLevel(LogLevel.INFO);

  const complexMeta = {
    string: "value",
    number: 123,
    boolean: true,
    null: null,
    array: [1, 2, 3],
    nested: {
      deep: {
        value: "nested",
      },
    },
  };

  const output = captureStderr(() => {
    logger.info("Complex metadata", complexMeta);
  });

  assertEquals(output.includes("Complex metadata"), true);
  assertEquals(output.includes("string"), true);
  assertEquals(output.includes("number"), true);
  assertEquals(output.includes("123"), true);
  assertEquals(output.includes("nested"), true);
});

Deno.test("Logger - changing level affects all subsequent logs", () => {
  const logger = Logger.getInstance();

  // Start at ERROR
  logger.setLevel(LogLevel.ERROR);
  let output = captureStderr(() => {
    logger.info("Should not appear");
  });
  assertEquals(output.includes("Should not appear"), false);

  // Change to INFO
  logger.setLevel(LogLevel.INFO);
  output = captureStderr(() => {
    logger.info("Should appear");
  });
  assertEquals(output.includes("Should appear"), true);

  // Reset
  logger.setLevel(LogLevel.INFO);
});
