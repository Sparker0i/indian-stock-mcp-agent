import type { Page } from "playwright";
import { NetworkInterceptor } from "../../browser/interceptor.js";
import { GROWW_PATTERNS, GROWW_URLS } from "./endpoints.js";
import type {
  GrowwRawHolding,
  GrowwHoldingsResponse,
  GrowwRawPosition,
  GrowwPositionsResponse,
  GrowwRawOrder,
  GrowwOrdersResponse,
  GrowwRawMutualFund,
  GrowwMutualFundsResponse,
  GrowwRawUSStock,
  GrowwUSStocksResponse,
  GrowwRawGold,
  GrowwGoldResponse,
  GrowwRawSearchResult,
} from "./types.js";
import { logger } from "../../utils/logger.js";
import { randomDelay } from "../../browser/helpers.js";

export class GrowwScraper {
  private interceptor: NetworkInterceptor;

  constructor() {
    this.interceptor = new NetworkInterceptor();
    this.interceptor.addPattern("holdings", GROWW_PATTERNS.holdings);
    this.interceptor.addPattern("mutualFunds", GROWW_PATTERNS.mutualFunds);
    this.interceptor.addPattern("positions", GROWW_PATTERNS.positions);
    this.interceptor.addPattern("orders", GROWW_PATTERNS.orders);
    this.interceptor.addPattern("usStocks", GROWW_PATTERNS.usStocks);
    this.interceptor.addPattern("gold", GROWW_PATTERNS.gold);
    this.interceptor.addPattern("search", GROWW_PATTERNS.search);
    this.interceptor.addPattern("quote", GROWW_PATTERNS.quote);
  }

  async attach(page: Page): Promise<void> {
    await this.interceptor.attach(page);
  }

  async fetchHoldings(page: Page): Promise<GrowwRawHolding[]> {
    logger.info("Groww: Fetching holdings");
    this.interceptor.clearPattern("holdings");

    await page.goto(GROWW_URLS.holdings, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    const result = this.interceptor.getLatestCapture("holdings");
    if (result?.body) {
      const holdings = this.extractHoldings(result.body);
      if (holdings.length > 0) {
        logger.info(`Groww: Captured ${holdings.length} holdings`);
        return holdings;
      }
    }

    logger.warn("Groww: No holdings captured via network interception");
    return [];
  }

  async fetchPositions(page: Page): Promise<GrowwRawPosition[]> {
    logger.info("Groww: Fetching positions");
    this.interceptor.clearPattern("positions");

    // Use holdings page as positions might be included there
    await page.goto(GROWW_URLS.holdings, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    const result = this.interceptor.getLatestCapture("positions");
    if (result?.body) {
      const positions = this.extractPositions(result.body);
      if (positions.length > 0) return positions;
    }

    return [];
  }

  async fetchOrders(page: Page): Promise<GrowwRawOrder[]> {
    logger.info("Groww: Fetching orders");
    this.interceptor.clearPattern("orders");

    await page.goto(GROWW_URLS.orders, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    const result = this.interceptor.getLatestCapture("orders");
    if (result?.body) {
      const orders = this.extractOrders(result.body);
      if (orders.length > 0) return orders;
    }

    return [];
  }

  async fetchMutualFunds(page: Page): Promise<GrowwRawMutualFund[]> {
    logger.info("Groww: Fetching mutual funds");
    this.interceptor.clearPattern("mutualFunds");

    await page.goto(GROWW_URLS.mfDashboard, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    const result = this.interceptor.getLatestCapture("mutualFunds");
    if (result?.body) {
      const mfs = this.extractMutualFunds(result.body);
      if (mfs.length > 0) {
        logger.info(`Groww: Captured ${mfs.length} mutual funds`);
        return mfs;
      }
    }

    logger.warn("Groww: No mutual funds captured via network interception");
    return [];
  }

  async fetchUSStocks(page: Page): Promise<GrowwRawUSStock[]> {
    logger.info("Groww: Fetching US stocks");
    this.interceptor.clearPattern("usStocks");

    await page.goto(GROWW_URLS.usStocks, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    const result = this.interceptor.getLatestCapture("usStocks");
    if (result?.body) {
      return this.extractUSStocks(result.body);
    }

    return [];
  }

  async fetchGold(page: Page): Promise<GrowwRawGold[]> {
    logger.info("Groww: Fetching gold holdings");
    this.interceptor.clearPattern("gold");

    await page.goto(GROWW_URLS.gold, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    const result = this.interceptor.getLatestCapture("gold");
    if (result?.body) {
      return this.extractGold(result.body);
    }

    return [];
  }

  async searchStocks(page: Page, query: string): Promise<GrowwRawSearchResult[]> {
    logger.info(`Groww: Searching for "${query}"`);
    this.interceptor.clearPattern("search");

    const searchInput = page.locator("input[class*='search'], input[placeholder*='Search']").first();
    try {
      await searchInput.waitFor({ timeout: 5000 });
      await searchInput.click();
      await randomDelay();
      await searchInput.fill(query);
      await randomDelay(500, 1500);
    } catch {
      logger.warn("Groww: Search input not found, navigating to search page");
      await page.goto(`${GROWW_URLS.base}/search?q=${encodeURIComponent(query)}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
    }

    const captures = this.interceptor.getCaptures("search");
    if (captures.length > 0) {
      const body = captures[captures.length - 1].body;
      if (Array.isArray(body)) return body as GrowwRawSearchResult[];
      const wrapped = body as { data?: GrowwRawSearchResult[]; results?: GrowwRawSearchResult[] };
      return wrapped.data || wrapped.results || [];
    }

    return [];
  }

  // --- Data extraction helpers (handle various response shapes) ---

  private extractHoldings(body: unknown): GrowwRawHolding[] {
    if (Array.isArray(body)) return body as GrowwRawHolding[];
    const obj = body as GrowwHoldingsResponse;
    return obj.holdings || obj.stocks || [];
  }

  private extractPositions(body: unknown): GrowwRawPosition[] {
    if (Array.isArray(body)) return body as GrowwRawPosition[];
    const obj = body as GrowwPositionsResponse;
    return obj.positions || [];
  }

  private extractOrders(body: unknown): GrowwRawOrder[] {
    if (Array.isArray(body)) return body as GrowwRawOrder[];
    const obj = body as GrowwOrdersResponse;
    return obj.orders || obj.orderBook || [];
  }

  private extractMutualFunds(body: unknown): GrowwRawMutualFund[] {
    if (Array.isArray(body)) return body as GrowwRawMutualFund[];
    const obj = body as GrowwMutualFundsResponse;
    return obj.holdings || [];
  }

  private extractUSStocks(body: unknown): GrowwRawUSStock[] {
    if (Array.isArray(body)) return body as GrowwRawUSStock[];
    const obj = body as GrowwUSStocksResponse;
    return obj.usStocks || obj.holdings || [];
  }

  private extractGold(body: unknown): GrowwRawGold[] {
    if (Array.isArray(body)) return body as GrowwRawGold[];
    const obj = body as GrowwGoldResponse;
    return obj.gold || obj.goldHoldings || [];
  }
}
