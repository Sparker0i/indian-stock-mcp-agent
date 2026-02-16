import type { BrowserContext, Page } from "playwright";
import type {
  BrokerAdapter,
  BrokerName,
  BrokerFeatures,
  SearchResult,
  Quote,
} from "../types/broker.js";
import type {
  Holding,
  Position,
  Order,
  MutualFundHolding,
  USStockHolding,
  GoldHolding,
} from "../types/portfolio.js";
import { NetworkInterceptor } from "../browser/interceptor.js";
import { logger } from "../utils/logger.js";

export abstract class BaseAdapter implements BrokerAdapter {
  abstract readonly name: BrokerName;
  abstract readonly displayName: string;
  abstract readonly loginUrl: string;
  abstract readonly dashboardUrl: string;
  abstract readonly supportedFeatures: BrokerFeatures;

  protected context: BrowserContext | null = null;
  protected interceptor: NetworkInterceptor;
  protected connected = false;
  protected connectedAt = 0;

  constructor() {
    this.interceptor = new NetworkInterceptor();
  }

  setContext(context: BrowserContext): void {
    this.context = context;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSessionAge(): number {
    if (!this.connected) return -1;
    return Math.floor((Date.now() - this.connectedAt) / 60000);
  }

  async connect(method: "browser_login" | "cookies", _cookies?: string): Promise<void> {
    this.connected = true;
    this.connectedAt = Date.now();
    logger.info(`${this.displayName} adapter marked as connected (method: ${method})`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connectedAt = 0;
    this.context = null;
    this.interceptor.clear();
    logger.info(`${this.displayName} adapter disconnected`);
  }

  protected async getPage(): Promise<Page> {
    if (!this.context) {
      throw new Error(`${this.displayName}: No browser context available. Connect first.`);
    }
    const pages = this.context.pages();
    if (pages.length > 0) return pages[0];
    return await this.context.newPage();
  }

  // Subclasses implement these based on their specific endpoints
  async getHoldings(): Promise<Holding[]> {
    this.ensureConnected();
    return [];
  }

  async getPositions(): Promise<Position[]> {
    this.ensureConnected();
    return [];
  }

  async getOrders(): Promise<Order[]> {
    this.ensureConnected();
    return [];
  }

  async getMutualFunds(): Promise<MutualFundHolding[]> {
    this.ensureConnected();
    return [];
  }

  async getUSStocks(): Promise<USStockHolding[]> {
    this.ensureConnected();
    return [];
  }

  async getGold(): Promise<GoldHolding[]> {
    this.ensureConnected();
    return [];
  }

  async getFnOPositions(): Promise<Position[]> {
    this.ensureConnected();
    return [];
  }

  async searchStock(_query: string): Promise<SearchResult[]> {
    this.ensureConnected();
    return [];
  }

  async getQuote(_symbol: string): Promise<Quote> {
    this.ensureConnected();
    throw new Error(`${this.displayName}: getQuote not implemented yet`);
  }

  protected ensureConnected(): void {
    if (!this.connected) {
      throw new Error(`${this.displayName} is not connected. Use broker_connect first.`);
    }
  }
}
