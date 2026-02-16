#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Starting Indian Broker MCP Server...");

  const { server, browserManager } = createServer();
  const transport = new StdioServerTransport();

  process.on("SIGINT", async () => {
    logger.info("Shutting down...");
    await browserManager.closeAll();
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Shutting down...");
    await browserManager.closeAll();
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  logger.info("Indian Broker MCP Server running on STDIO");
}

main().catch((err) => {
  logger.error(`Fatal error: ${err}`);
  process.exit(1);
});
