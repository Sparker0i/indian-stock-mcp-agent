import type { Page } from "playwright";

export async function randomDelay(minMs: number = 50, maxMs: number = 200): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function waitForNavigation(
  page: Page,
  urlPattern: string | RegExp,
  timeoutMs: number = 30000,
): Promise<void> {
  await page.waitForURL(urlPattern, { timeout: timeoutMs });
}

export async function waitForSelector(
  page: Page,
  selector: string,
  timeoutMs: number = 15000,
): Promise<void> {
  await page.waitForSelector(selector, { timeout: timeoutMs });
}

export async function takeScreenshot(page: Page, filePath: string): Promise<void> {
  await page.screenshot({ path: filePath, fullPage: true });
}

export async function getAccessibilityTree(page: Page): Promise<unknown> {
  return await page.evaluate(() => document.body.innerText);
}

export async function checkForLoginRedirect(page: Page, loginUrlPattern: string | RegExp): Promise<boolean> {
  return !!page.url().match(loginUrlPattern);
}
