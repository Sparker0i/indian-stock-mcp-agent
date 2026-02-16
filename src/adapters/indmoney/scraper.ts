import type { Page } from "playwright";
import { NetworkInterceptor } from "../../browser/interceptor.js";
import { INDMONEY_PATTERNS, INDMONEY_URLS } from "./endpoints.js";
import type {
  IndmoneyRawHolding,
  IndmoneyHoldingsResponse,
  IndmoneyRawMutualFund,
  IndmoneyMutualFundsResponse,
  IndmoneyRawUSStock,
  IndmoneyUSStocksResponse,
  IndmoneyRawGold,
  IndmoneyGoldResponse,
  IndmoneyRawOrder,
  IndmoneyOrdersResponse,
} from "./types.js";
import { logger } from "../../utils/logger.js";
import { randomDelay } from "../../browser/helpers.js";

export class IndmoneyScraper {
  private interceptor: NetworkInterceptor;

  constructor() {
    this.interceptor = new NetworkInterceptor();
    this.interceptor.addPattern("indianStocks", INDMONEY_PATTERNS.indianStocks);
    this.interceptor.addPattern("indianStocksApi", INDMONEY_PATTERNS.indianStocksApi);
    this.interceptor.addPattern("mutualFunds", INDMONEY_PATTERNS.mutualFunds);
    this.interceptor.addPattern("mutualFundsApi", INDMONEY_PATTERNS.mutualFundsApi);
    this.interceptor.addPattern("usStocks", INDMONEY_PATTERNS.usStocks);
    this.interceptor.addPattern("usStocksApi", INDMONEY_PATTERNS.usStocksApi);
    this.interceptor.addPattern("gold", INDMONEY_PATTERNS.gold);
    this.interceptor.addPattern("goldApi", INDMONEY_PATTERNS.goldApi);
    this.interceptor.addPattern("orders", INDMONEY_PATTERNS.orders);
    this.interceptor.addPattern("portfolio", INDMONEY_PATTERNS.portfolio);
  }

  async attach(page: Page): Promise<void> {
    await this.interceptor.attach(page);
  }

  async fetchHoldings(page: Page): Promise<IndmoneyRawHolding[]> {
    logger.info("INDmoney: Fetching Indian stock holdings");
    this.interceptor.clearPattern("indianStocks");
    this.interceptor.clearPattern("indianStocksApi");

    await page.goto(INDMONEY_URLS.indianStocks, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    for (const pattern of ["indianStocksApi", "indianStocks", "portfolio"]) {
      const captures = this.interceptor.getCaptures(pattern);
      for (const capture of captures) {
        const holdings = this.extractHoldings(capture.body);
        if (holdings.length > 0) {
          logger.info(`INDmoney: Captured ${holdings.length} holdings via ${pattern}`);
          return holdings;
        }
      }
    }

    logger.warn("INDmoney: No holdings captured via network interception");
    return [];
  }

  async fetchMutualFunds(page: Page): Promise<IndmoneyRawMutualFund[]> {
    logger.info("INDmoney: Fetching mutual funds");
    this.interceptor.clearPattern("mutualFunds");
    this.interceptor.clearPattern("mutualFundsApi");

    await page.goto(INDMONEY_URLS.mutualFunds, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    for (const pattern of ["mutualFundsApi", "mutualFunds"]) {
      const captures = this.interceptor.getCaptures(pattern);
      for (const capture of captures) {
        const mfs = this.extractMutualFunds(capture.body);
        if (mfs.length > 0) {
          logger.info(`INDmoney: Captured ${mfs.length} mutual funds via ${pattern}`);
          return mfs;
        }
      }
    }

    return [];
  }

  async fetchUSStocks(page: Page): Promise<IndmoneyRawUSStock[]> {
    logger.info("INDmoney: Fetching US stocks");
    this.interceptor.clearPattern("usStocks");
    this.interceptor.clearPattern("usStocksApi");

    await page.goto(INDMONEY_URLS.usStocks, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    for (const pattern of ["usStocksApi", "usStocks"]) {
      const captures = this.interceptor.getCaptures(pattern);
      for (const capture of captures) {
        const stocks = this.extractUSStocks(capture.body);
        if (stocks.length > 0) {
          logger.info(`INDmoney: Captured ${stocks.length} US stocks via ${pattern}`);
          return stocks;
        }
      }
    }

    return [];
  }

  async fetchGold(page: Page): Promise<IndmoneyRawGold[]> {
    logger.info("INDmoney: Fetching gold holdings");
    this.interceptor.clearPattern("gold");
    this.interceptor.clearPattern("goldApi");

    await page.goto(INDMONEY_URLS.gold, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    for (const pattern of ["goldApi", "gold"]) {
      const captures = this.interceptor.getCaptures(pattern);
      for (const capture of captures) {
        const gold = this.extractGold(capture.body);
        if (gold.length > 0) {
          logger.info(`INDmoney: Captured ${gold.length} gold holdings via ${pattern}`);
          return gold;
        }
      }
    }

    return [];
  }

  async fetchOrders(page: Page): Promise<IndmoneyRawOrder[]> {
    logger.info("INDmoney: Fetching orders");
    this.interceptor.clearPattern("orders");

    await page.goto(INDMONEY_URLS.orders, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    const captures = this.interceptor.getCaptures("orders");
    for (const capture of captures) {
      const orders = this.extractOrders(capture.body);
      if (orders.length > 0) {
        logger.info(`INDmoney: Captured ${orders.length} orders`);
        return orders;
      }
    }

    return [];
  }

  // --- Data extraction helpers ---

  private extractHoldings(body: unknown): IndmoneyRawHolding[] {
    if (Array.isArray(body)) return body as IndmoneyRawHolding[];
    const obj = body as IndmoneyHoldingsResponse;
    return obj.holdings || obj.stocks || [];
  }

  private extractMutualFunds(body: unknown): IndmoneyRawMutualFund[] {
    if (Array.isArray(body)) return body as IndmoneyRawMutualFund[];
    const obj = body as IndmoneyMutualFundsResponse;
    return obj.mutualFunds || obj.investments || obj.holdings || [];
  }

  private extractUSStocks(body: unknown): IndmoneyRawUSStock[] {
    if (Array.isArray(body)) return body as IndmoneyRawUSStock[];
    const obj = body as IndmoneyUSStocksResponse;
    return obj.usStocks || obj.holdings || [];
  }

  private extractGold(body: unknown): IndmoneyRawGold[] {
    if (Array.isArray(body)) return body as IndmoneyRawGold[];
    const obj = body as IndmoneyGoldResponse;
    return obj.gold || obj.goldHoldings || [];
  }

  private extractOrders(body: unknown): IndmoneyRawOrder[] {
    if (Array.isArray(body)) return body as IndmoneyRawOrder[];
    const obj = body as IndmoneyOrdersResponse;
    return obj.orders || [];
  }
}
