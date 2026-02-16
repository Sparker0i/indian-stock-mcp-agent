import type { Page, Response } from "playwright";
import { logger } from "../utils/logger.js";

export interface InterceptionResult {
  url: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}

interface PatternEntry {
  pattern: string | RegExp;
  captures: InterceptionResult[];
}

export class NetworkInterceptor {
  private patterns: Map<string, PatternEntry> = new Map();
  private attached = false;

  addPattern(name: string, urlPattern: string | RegExp): void {
    this.patterns.set(name, { pattern: urlPattern, captures: [] });
  }

  async attach(page: Page): Promise<void> {
    if (this.attached) return;

    page.on("response", async (response: Response) => {
      const url = response.url();
      const request = response.request();
      const resourceType = request.resourceType();

      if (resourceType !== "xhr" && resourceType !== "fetch") return;

      for (const [name, entry] of this.patterns) {
        const matches =
          typeof entry.pattern === "string"
            ? url.includes(entry.pattern)
            : entry.pattern.test(url);

        if (matches && response.status() === 200) {
          try {
            const body = await response.json();
            const result: InterceptionResult = {
              url,
              method: request.method(),
              status: response.status(),
              headers: response.headers(),
              body,
              timestamp: Date.now(),
            };
            entry.captures.push(result);
            logger.debug(`Intercepted [${name}]: ${request.method()} ${url}`);
          } catch {
            logger.debug(`Non-JSON response for [${name}]: ${url}`);
          }
        }
      }
    });

    this.attached = true;
  }

  async navigateAndCapture(
    page: Page,
    url: string,
    patternName: string,
    timeoutMs: number = 15000,
  ): Promise<InterceptionResult | null> {
    const entry = this.patterns.get(patternName);
    if (!entry) {
      logger.error(`Pattern "${patternName}" not registered`);
      return null;
    }

    const countBefore = entry.captures.length;

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for a new capture
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (entry.captures.length > countBefore) {
        return entry.captures[entry.captures.length - 1];
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.warn(`No capture for pattern "${patternName}" within ${timeoutMs}ms`);
    return null;
  }

  getCaptures(patternName: string): InterceptionResult[] {
    return this.patterns.get(patternName)?.captures ?? [];
  }

  getLatestCapture(patternName: string): InterceptionResult | null {
    const captures = this.getCaptures(patternName);
    return captures.length > 0 ? captures[captures.length - 1] : null;
  }

  clear(): void {
    for (const entry of this.patterns.values()) {
      entry.captures = [];
    }
  }

  clearPattern(patternName: string): void {
    const entry = this.patterns.get(patternName);
    if (entry) entry.captures = [];
  }
}
