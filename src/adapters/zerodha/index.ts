import type { BrowserContext } from "playwright";
import { BaseAdapter } from "../base.js";
import type { BrokerName, BrokerFeatures, SearchResult, Quote } from "../../types/broker.js";
import type { Holding, Position, Order, MutualFundHolding } from "../../types/portfolio.js";
import { ZerodhaScraper } from "./scraper.js";
import type {
  KiteRawHolding,
  KiteRawPosition,
  KiteRawOrder,
  CoinRawMutualFund,
} from "./types.js";
import { logger } from "../../utils/logger.js";
import { retry } from "../../utils/retry.js";

export class ZerodhaAdapter extends BaseAdapter {
  readonly name: BrokerName = "zerodha";
  readonly displayName = "Zerodha Kite";
  readonly loginUrl = "https://kite.zerodha.com/";
  readonly dashboardUrl = "https://kite.zerodha.com/holdings";
  readonly supportedFeatures: BrokerFeatures = {
    stocks: true,
    fno: true,
    mutualFunds: true,
    usStocks: false,
    gold: false,
  };

  private scraper: ZerodhaScraper;
  private scraperAttached = false;

  constructor() {
    super();
    this.scraper = new ZerodhaScraper();
  }

  override setContext(context: BrowserContext): void {
    super.setContext(context);
    this.scraperAttached = false;
  }

  private async ensureScraper(): Promise<void> {
    if (this.scraperAttached) return;
    const page = await this.getPage();
    await this.scraper.attach(page);
    this.scraperAttached = true;
  }

  override async getHoldings(): Promise<Holding[]> {
    this.ensureConnected();
    await this.ensureScraper();

    return retry(async () => {
      const page = await this.getPage();
      const raw = await this.scraper.fetchHoldings(page);
      return raw.map((h) => this.normalizeHolding(h));
    });
  }

  override async getPositions(): Promise<Position[]> {
    this.ensureConnected();
    await this.ensureScraper();

    return retry(async () => {
      const page = await this.getPage();
      const raw = await this.scraper.fetchPositions(page);
      return raw.net.map((p) => this.normalizePosition(p));
    });
  }

  override async getFnOPositions(): Promise<Position[]> {
    this.ensureConnected();
    await this.ensureScraper();

    return retry(async () => {
      const page = await this.getPage();
      const raw = await this.scraper.fetchPositions(page);
      const fno = raw.net.filter(
        (p) => p.tradingsymbol.match(/\d{2}[A-Z]{3}\d{2,4}(CE|PE|FUT)/) || p.exchange === "NFO" || p.exchange === "BFO",
      );
      return fno.map((p) => this.normalizePosition(p));
    });
  }

  override async getOrders(): Promise<Order[]> {
    this.ensureConnected();
    await this.ensureScraper();

    return retry(async () => {
      const page = await this.getPage();
      const raw = await this.scraper.fetchOrders(page);
      return raw.map((o) => this.normalizeOrder(o));
    });
  }

  override async getMutualFunds(): Promise<MutualFundHolding[]> {
    this.ensureConnected();
    await this.ensureScraper();

    return retry(async () => {
      const page = await this.getPage();
      const raw = await this.scraper.fetchMutualFunds(page);
      return raw.map((m) => this.normalizeMutualFund(m));
    });
  }

  override async searchStock(query: string): Promise<SearchResult[]> {
    this.ensureConnected();
    await this.ensureScraper();

    const page = await this.getPage();
    const raw = await this.scraper.searchInstruments(page, query);
    return raw.map((r) => ({
      symbol: r.tradingsymbol,
      name: r.name,
      exchange: r.exchange,
      instrumentType: r.instrument_type,
    }));
  }

  override async getQuote(symbol: string): Promise<Quote> {
    this.ensureConnected();
    await this.ensureScraper();

    const page = await this.getPage();
    const raw = await this.scraper.fetchQuote(page, symbol);
    if (!raw) throw new Error(`No quote available for ${symbol}`);

    return {
      symbol,
      exchange: "NSE",
      lastPrice: raw.last_price,
      change: raw.net_change,
      changePercent: raw.ohlc.close > 0 ? (raw.net_change / raw.ohlc.close) * 100 : 0,
      open: raw.ohlc.open,
      high: raw.ohlc.high,
      low: raw.ohlc.low,
      close: raw.ohlc.close,
      volume: raw.volume,
      timestamp: raw.timestamp,
    };
  }

  // --- Normalizers ---

  private normalizeHolding(raw: KiteRawHolding): Holding {
    const investedValue = raw.average_price * raw.quantity;
    const currentValue = raw.last_price * raw.quantity;
    return {
      broker: this.name,
      symbol: raw.tradingsymbol,
      isin: raw.isin,
      name: raw.tradingsymbol,
      quantity: raw.quantity,
      averagePrice: raw.average_price,
      currentPrice: raw.last_price,
      investedValue,
      currentValue,
      pnl: raw.pnl,
      pnlPercent: investedValue > 0 ? (raw.pnl / investedValue) * 100 : 0,
      exchange: raw.exchange,
      assetType: "EQUITY",
    };
  }

  private normalizePosition(raw: KiteRawPosition): Position {
    const instrumentType = this.inferInstrumentType(raw.tradingsymbol, raw.exchange);
    return {
      broker: this.name,
      symbol: raw.tradingsymbol,
      exchange: raw.exchange,
      quantity: raw.quantity,
      averagePrice: raw.average_price,
      lastPrice: raw.last_price,
      pnl: raw.pnl,
      product: raw.product,
      instrumentType,
    };
  }

  private normalizeOrder(raw: KiteRawOrder): Order {
    return {
      broker: this.name,
      orderId: raw.order_id,
      symbol: raw.tradingsymbol,
      exchange: raw.exchange,
      type: raw.transaction_type as "BUY" | "SELL",
      orderType: this.mapOrderType(raw.order_type),
      product: raw.product,
      quantity: raw.quantity,
      price: raw.price || raw.average_price,
      triggerPrice: raw.trigger_price || undefined,
      status: this.mapOrderStatus(raw.status),
      timestamp: raw.order_timestamp,
    };
  }

  private normalizeMutualFund(raw: CoinRawMutualFund): MutualFundHolding {
    return {
      broker: this.name,
      schemeName: raw.scheme_name,
      amcName: raw.amc,
      folioNumber: raw.folio,
      units: raw.units,
      nav: raw.nav,
      investedValue: raw.invested,
      currentValue: raw.current_value,
      returns: raw.pnl,
      returnsPercent: raw.pnl_percentage,
      xirr: raw.xirr,
      sipActive: raw.sip_active,
      category: raw.category,
    };
  }

  private inferInstrumentType(symbol: string, exchange: string): "EQ" | "FUT" | "CE" | "PE" {
    if (exchange === "NFO" || exchange === "BFO") {
      if (symbol.endsWith("CE")) return "CE";
      if (symbol.endsWith("PE")) return "PE";
      if (symbol.includes("FUT")) return "FUT";
    }
    return "EQ";
  }

  private mapOrderType(type: string): "MARKET" | "LIMIT" | "SL" | "SLM" {
    const map: Record<string, "MARKET" | "LIMIT" | "SL" | "SLM"> = {
      MARKET: "MARKET",
      LIMIT: "LIMIT",
      SL: "SL",
      "SL-M": "SLM",
      SLM: "SLM",
    };
    return map[type] || "MARKET";
  }

  private mapOrderStatus(status: string): "OPEN" | "COMPLETE" | "CANCELLED" | "REJECTED" {
    const s = status.toUpperCase();
    if (s === "COMPLETE") return "COMPLETE";
    if (s === "CANCELLED") return "CANCELLED";
    if (s === "REJECTED") return "REJECTED";
    return "OPEN";
  }
}
