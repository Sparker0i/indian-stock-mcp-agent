import type { Page } from "playwright";
import type { BrokerName } from "../types/broker.js";
import type { SessionStore } from "../auth/session-store.js";
import type { SessionData } from "../types/auth.js";
import { logger } from "../utils/logger.js";
import { config } from "../utils/config.js";

interface BrokerLoginConfig {
  loginUrl: string;
  dashboardPattern: RegExp;
  sessionCookieName?: string;
}

const LOGIN_CONFIGS: Record<BrokerName, BrokerLoginConfig> = {
  groww: {
    loginUrl: "https://groww.in/login",
    dashboardPattern: /groww\.in\/(dashboard|stocks\/user|mutual-funds\/user)/,
  },
  zerodha: {
    loginUrl: "https://kite.zerodha.com/",
    dashboardPattern: /kite\.zerodha\.com\/(dashboard|holdings|positions)/,
    sessionCookieName: "enctoken",
  },
  indmoney: {
    loginUrl: "https://www.indmoney.com/",
    dashboardPattern: /indmoney\.com\/dashboard/,
  },
};

export class AuthFlow {
  private broker: BrokerName;
  private loginConfig: BrokerLoginConfig;

  constructor(broker: BrokerName) {
    this.broker = broker;
    this.loginConfig = LOGIN_CONFIGS[broker];
  }

  async startLogin(page: Page, sessionStore: SessionStore): Promise<void> {
    logger.info(`Starting login flow for ${this.broker}`);
    await page.goto(this.loginConfig.loginUrl, { waitUntil: "networkidle", timeout: 30000 });

    // Monitor for login success in the background
    this.monitorLogin(page, sessionStore).catch((err) => {
      logger.error(`Login monitoring error for ${this.broker}: ${err}`);
    });
  }

  private async monitorLogin(page: Page, sessionStore: SessionStore): Promise<void> {
    const timeout = 300000; // 5 minutes for user to log in
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // Check URL-based detection
        const currentUrl = page.url();
        if (this.loginConfig.dashboardPattern.test(currentUrl)) {
          logger.info(`Dashboard detected for ${this.broker}: ${currentUrl}`);
          await this.captureSession(page, sessionStore);
          return;
        }

        // Check cookie-based detection
        if (this.loginConfig.sessionCookieName) {
          const cookies = await page.context().cookies();
          const sessionCookie = cookies.find((c) => c.name === this.loginConfig.sessionCookieName);
          if (sessionCookie) {
            logger.info(`Session cookie detected for ${this.broker}`);
            await this.captureSession(page, sessionStore);
            return;
          }
        }
      } catch {
        // Page may have navigated, ignore errors
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    logger.warn(`Login monitoring timed out for ${this.broker}`);
  }

  private async captureSession(page: Page, sessionStore: SessionStore): Promise<void> {
    const cookies = await page.context().cookies();
    const cookieString = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const ttlMs = config.sessionTtlHours * 60 * 60 * 1000;
    const session: SessionData = {
      broker: this.broker,
      cookies: cookieString,
      connectedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    sessionStore.store(session);
    logger.info(`Session captured for ${this.broker}`);
  }

  async connectWithCookies(
    page: Page,
    rawCookies: string,
    sessionStore: SessionStore,
  ): Promise<void> {
    logger.info(`Connecting to ${this.broker} via cookies`);

    const cookiePairs = rawCookies.split(";").map((pair) => pair.trim());
    const parsedCookies = cookiePairs
      .filter((pair) => pair.includes("="))
      .map((pair) => {
        const eqIdx = pair.indexOf("=");
        const name = pair.substring(0, eqIdx).trim();
        const value = pair.substring(eqIdx + 1).trim();
        return { name, value, domain: this.getDomain(), path: "/" };
      });

    await page.context().addCookies(parsedCookies);

    // Navigate to dashboard to validate
    await page.goto(this.getDashboardUrl(), { waitUntil: "networkidle", timeout: 30000 });

    const currentUrl = page.url();
    if (this.loginConfig.dashboardPattern.test(currentUrl)) {
      await this.captureSession(page, sessionStore);
      logger.info(`Cookie-based connection successful for ${this.broker}`);
    } else {
      throw new Error(`Cookie validation failed for ${this.broker}. Redirected to: ${currentUrl}`);
    }
  }

  private getDomain(): string {
    const domains: Record<BrokerName, string> = {
      groww: ".groww.in",
      zerodha: ".zerodha.com",
      indmoney: ".indmoney.com",
    };
    return domains[this.broker];
  }

  private getDashboardUrl(): string {
    const urls: Record<BrokerName, string> = {
      groww: "https://groww.in/dashboard/investments",
      zerodha: "https://kite.zerodha.com/holdings",
      indmoney: "https://www.indmoney.com/dashboard",
    };
    return urls[this.broker];
  }
}
