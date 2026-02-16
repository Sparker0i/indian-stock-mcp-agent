import { chromium, type BrowserContext } from "playwright";
import path from "path";
import fs from "fs";
import type { BrokerName } from "../types/broker.js";
import type { Config } from "../utils/config.js";
import { logger } from "../utils/logger.js";

export class BrowserManager {
  private contexts: Map<BrokerName, BrowserContext> = new Map();
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async getContext(broker: BrokerName, headed: boolean): Promise<BrowserContext> {
    const existing = this.contexts.get(broker);
    if (existing) return existing;

    const userDataDir = path.join(this.config.browserDataDir, broker);
    fs.mkdirSync(userDataDir, { recursive: true });

    logger.info(`Launching browser context for ${broker} (headed=${headed})`);

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: !headed && this.config.browserHeadless,
      channel: "chrome",
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      viewport: { width: 1280, height: 800 },
      slowMo: headed ? this.config.browserSlowMo : 0,
    });

    // Anti-detection
    for (const page of context.pages()) {
      await this.applyAntiDetection(page);
    }
    context.on("page", async (page) => {
      await this.applyAntiDetection(page);
    });

    this.contexts.set(broker, context);
    return context;
  }

  private async applyAntiDetection(page: import("playwright").Page): Promise<void> {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
  }

  async closeContext(broker: BrokerName): Promise<void> {
    const context = this.contexts.get(broker);
    if (context) {
      await context.close();
      this.contexts.delete(broker);
      logger.info(`Browser context closed for ${broker}`);
    }

    // Delete persistent context data
    const userDataDir = path.join(this.config.browserDataDir, broker);
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      logger.info(`Browser data deleted for ${broker}`);
    }
  }

  async closeAll(): Promise<void> {
    for (const [broker, context] of this.contexts) {
      await context.close();
      logger.info(`Browser context closed for ${broker}`);
    }
    this.contexts.clear();
  }

  hasContext(broker: BrokerName): boolean {
    return this.contexts.has(broker);
  }
}
