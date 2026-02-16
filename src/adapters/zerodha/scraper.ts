import type { Page } from "playwright";
import { NetworkInterceptor } from "../../browser/interceptor.js";
import { KITE_PATTERNS, KITE_URLS } from "./endpoints.js";
import type {
  KiteApiResponse,
  KiteRawHolding,
  KitePositionsData,
  KiteRawOrder,
  KiteRawQuote,
  KiteRawSearchResult,
  CoinRawMutualFund,
} from "./types.js";
import { logger } from "../../utils/logger.js";
import { randomDelay } from "../../browser/helpers.js";

export class ZerodhaScraper {
  private interceptor: NetworkInterceptor;

  constructor() {
    this.interceptor = new NetworkInterceptor();
    this.interceptor.addPattern("holdings", KITE_PATTERNS.holdings);
    this.interceptor.addPattern("positions", KITE_PATTERNS.positions);
    this.interceptor.addPattern("orders", KITE_PATTERNS.orders);
    this.interceptor.addPattern("quote", KITE_PATTERNS.quote);
    this.interceptor.addPattern("search", KITE_PATTERNS.search);
    this.interceptor.addPattern("coinHoldings", KITE_PATTERNS.coinHoldings);
  }

  async attach(page: Page): Promise<void> {
    await this.interceptor.attach(page);
  }

  async fetchHoldings(page: Page): Promise<KiteRawHolding[]> {
    logger.info("Zerodha: Fetching holdings via network interception");
    this.interceptor.clearPattern("holdings");

    const result = await this.interceptor.navigateAndCapture(
      page,
      KITE_URLS.holdings,
      "holdings",
      15000,
    );

    if (result?.body) {
      const response = result.body as KiteApiResponse<KiteRawHolding[]>;
      if (response.status === "success" && Array.isArray(response.data)) {
        logger.info(`Zerodha: Captured ${response.data.length} holdings`);
        return response.data;
      }
    }

    logger.warn("Zerodha: Network interception failed for holdings, trying cached data");
    const cached = this.interceptor.getLatestCapture("holdings");
    if (cached?.body) {
      const response = cached.body as KiteApiResponse<KiteRawHolding[]>;
      if (response.status === "success") return response.data;
    }

    return [];
  }

  async fetchPositions(page: Page): Promise<KitePositionsData> {
    logger.info("Zerodha: Fetching positions via network interception");
    this.interceptor.clearPattern("positions");

    const result = await this.interceptor.navigateAndCapture(
      page,
      KITE_URLS.positions,
      "positions",
      15000,
    );

    if (result?.body) {
      const response = result.body as KiteApiResponse<KitePositionsData>;
      if (response.status === "success" && response.data) {
        const count = (response.data.net?.length ?? 0) + (response.data.day?.length ?? 0);
        logger.info(`Zerodha: Captured ${count} positions`);
        return response.data;
      }
    }

    return { net: [], day: [] };
  }

  async fetchOrders(page: Page): Promise<KiteRawOrder[]> {
    logger.info("Zerodha: Fetching orders via network interception");
    this.interceptor.clearPattern("orders");

    const result = await this.interceptor.navigateAndCapture(
      page,
      KITE_URLS.orders,
      "orders",
      15000,
    );

    if (result?.body) {
      const response = result.body as KiteApiResponse<KiteRawOrder[]>;
      if (response.status === "success" && Array.isArray(response.data)) {
        logger.info(`Zerodha: Captured ${response.data.length} orders`);
        return response.data;
      }
    }

    return [];
  }

  async fetchMutualFunds(page: Page): Promise<CoinRawMutualFund[]> {
    logger.info("Zerodha: Fetching mutual funds from Coin");
    this.interceptor.clearPattern("coinHoldings");

    // Coin is on a different subdomain
    const result = await this.interceptor.navigateAndCapture(
      page,
      KITE_URLS.coin,
      "coinHoldings",
      20000,
    );

    if (result?.body) {
      const data = result.body;
      if (Array.isArray(data)) {
        logger.info(`Zerodha: Captured ${data.length} mutual fund holdings`);
        return data as CoinRawMutualFund[];
      }
      // Coin API may wrap in an object
      const wrapped = data as { data?: CoinRawMutualFund[] };
      if (wrapped.data && Array.isArray(wrapped.data)) {
        return wrapped.data;
      }
    }

    return [];
  }

  async fetchQuote(page: Page, symbol: string, exchange: string = "NSE"): Promise<KiteRawQuote | null> {
    logger.info(`Zerodha: Fetching quote for ${exchange}:${symbol}`);
    this.interceptor.clearPattern("quote");

    // Navigate to the instrument page to trigger quote API call
    const instrumentUrl = `${KITE_URLS.base}/chart/${exchange}/${symbol}`;
    await page.goto(instrumentUrl, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {
      // Chart page might not exist, try search instead
    });
    await randomDelay(500, 1000);

    const captures = this.interceptor.getCaptures("quote");
    for (const capture of captures) {
      const body = capture.body as KiteApiResponse<Record<string, KiteRawQuote>>;
      if (body.status === "success" && body.data) {
        const key = `${exchange}:${symbol}`;
        if (body.data[key]) return body.data[key];
        // Try first available quote
        const quotes = Object.values(body.data);
        if (quotes.length > 0) return quotes[0];
      }
    }

    return null;
  }

  async searchInstruments(page: Page, query: string): Promise<KiteRawSearchResult[]> {
    logger.info(`Zerodha: Searching for "${query}"`);

    // Type into the Kite search box to trigger instrument search API
    const searchInput = page.locator("input.search, input[placeholder*='Search']").first();
    try {
      await searchInput.waitFor({ timeout: 5000 });
      await searchInput.click();
      await randomDelay();
      await searchInput.fill(query);
      await randomDelay(500, 1500);
    } catch {
      logger.warn("Zerodha: Search input not found");
      return [];
    }

    // Check for intercepted search results
    const captures = this.interceptor.getCaptures("search");
    if (captures.length > 0) {
      const latest = captures[captures.length - 1];
      if (Array.isArray(latest.body)) {
        return latest.body as KiteRawSearchResult[];
      }
    }

    return [];
  }
}
