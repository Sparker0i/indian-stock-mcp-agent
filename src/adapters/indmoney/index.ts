import type { BrowserContext } from "playwright";
import { BaseAdapter } from "../base.js";
import type { BrokerName, BrokerFeatures, SearchResult, Quote } from "../../types/broker.js";
import type {
  Holding,
  Position,
  Order,
  MutualFundHolding,
  USStockHolding,
  GoldHolding,
} from "../../types/portfolio.js";
import { IndmoneyScraper } from "./scraper.js";
import type {
  IndmoneyRawHolding,
  IndmoneyRawMutualFund,
  IndmoneyRawUSStock,
  IndmoneyRawGold,
  IndmoneyRawOrder,
} from "./types.js";
import { retry } from "../../utils/retry.js";

export class IndmoneyAdapter extends BaseAdapter {
  readonly name: BrokerName = "indmoney";
  readonly displayName = "INDmoney";
  readonly loginUrl = "https://www.indmoney.com/";
  readonly dashboardUrl = "https://www.indmoney.com/dashboard";
  readonly supportedFeatures: BrokerFeatures = {
    stocks: true,
    fno: false,
    mutualFunds: true,
    usStocks: true,
    gold: true,
  };

  private scraper: IndmoneyScraper;
  private scraperAttached = false;

  constructor() {
    super();
    this.scraper = new IndmoneyScraper();
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

  override async getUSStocks(): Promise<USStockHolding[]> {
    this.ensureConnected();
    await this.ensureScraper();
    return retry(async () => {
      const page = await this.getPage();
      const raw = await this.scraper.fetchUSStocks(page);
      return raw.map((u) => this.normalizeUSStock(u));
    });
  }

  override async getGold(): Promise<GoldHolding[]> {
    this.ensureConnected();
    await this.ensureScraper();
    return retry(async () => {
      const page = await this.getPage();
      const raw = await this.scraper.fetchGold(page);
      return raw.map((g) => this.normalizeGold(g));
    });
  }

  // F&O not supported by INDmoney
  override async getPositions(): Promise<Position[]> {
    return [];
  }

  override async getFnOPositions(): Promise<Position[]> {
    return [];
  }

  override async searchStock(_query: string): Promise<SearchResult[]> {
    this.ensureConnected();
    return [];
  }

  override async getQuote(symbol: string): Promise<Quote> {
    this.ensureConnected();
    throw new Error(`INDmoney: getQuote for ${symbol} not supported`);
  }

  // --- Normalizers ---

  private normalizeHolding(raw: IndmoneyRawHolding): Holding {
    const currentPrice = raw.currentPrice ?? raw.ltp ?? 0;
    return {
      broker: this.name,
      symbol: raw.symbol || raw.tradingSymbol || raw.isin,
      isin: raw.isin,
      name: raw.companyName,
      quantity: raw.quantity,
      averagePrice: raw.averagePrice,
      currentPrice,
      investedValue: raw.investedValue,
      currentValue: raw.currentValue,
      pnl: raw.pnl,
      pnlPercent: raw.pnlPercentage,
      exchange: raw.exchange || "NSE",
      assetType: "EQUITY",
    };
  }

  private normalizeOrder(raw: IndmoneyRawOrder): Order {
    return {
      broker: this.name,
      orderId: raw.orderId,
      symbol: raw.symbol || raw.tradingSymbol || "",
      exchange: raw.exchange || "NSE",
      type: raw.transactionType.toUpperCase() as "BUY" | "SELL",
      orderType: this.mapOrderType(raw.orderType),
      product: raw.product || "CNC",
      quantity: raw.quantity,
      price: raw.price,
      triggerPrice: raw.triggerPrice,
      status: this.mapOrderStatus(raw.status),
      timestamp: raw.timestamp || raw.orderTime || "",
    };
  }

  private normalizeMutualFund(raw: IndmoneyRawMutualFund): MutualFundHolding {
    const schemeName = raw.schemeName
      || raw.title?.text
      || raw.sort_filter_tags?.fundName
      || "Unknown Scheme";

    const investedValue = raw.investedAmount
      ?? raw.investedValue
      ?? raw.sort_filter_tags?.investedAmount
      ?? this.parseCurrency(raw.column1?.subTitle?.text)
      ?? 0;

    const currentValue = raw.currentValue
      ?? raw.sort_filter_tags?.currentValue
      ?? this.parseCurrency(raw.column2?.subTitle?.text)
      ?? 0;

    const returns = raw.returns ?? raw.pnl ?? (currentValue - investedValue);

    const returnsPercent = raw.returnsPercentage
      ?? raw.pnlPercentage
      ?? raw.sort_filter_tags?.gainPercentage
      ?? (investedValue > 0 ? (returns / investedValue) * 100 : 0);

    const units = raw.units
      ?? this.parseUnits(raw.column3?.values?.[3]?.subTitle?.text)
      ?? 0;

    const xirr = raw.xirr
      ?? raw.sort_filter_tags?.xirr
      ?? this.parsePercent(raw.column3?.values?.[2]?.subTitle?.text);

    return {
      broker: this.name,
      schemeName,
      amcName: raw.amcName || raw.amc || "",
      folioNumber: raw.folioNumber || raw.folio || "",
      units,
      nav: raw.nav ?? 0,
      investedValue,
      currentValue,
      returns,
      returnsPercent,
      xirr,
      sipActive: raw.sipActive ?? raw.isSipActive ?? false,
      category: raw.category
        || raw.sort_filter_tags?.category?.[0]
        || raw.sort_filter_tags?.subCategory?.[0]
        || raw.subCategory
        || "",
    };
  }

  private parseCurrency(value?: string): number | undefined {
    if (!value) return undefined;
    const compact = value.replace(/,/g, "").trim();
    const lower = compact.toLowerCase();
    const numeric = parseFloat(lower.replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(numeric)) return undefined;
    if (lower.includes("cr")) return numeric * 10000000;
    if (lower.includes("l")) return numeric * 100000;
    if (lower.includes("k")) return numeric * 1000;
    return numeric;
  }

  private parsePercent(value?: string): number | undefined {
    if (!value) return undefined;
    const numeric = parseFloat(value.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(numeric) ? undefined : numeric;
  }

  private parseUnits(value?: string): number | undefined {
    if (!value) return undefined;
    const compact = value.replace(/,/g, "").trim().toLowerCase();
    const numeric = parseFloat(compact.replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(numeric)) return undefined;
    if (compact.includes("k")) return numeric * 1000;
    if (compact.includes("m")) return numeric * 1000000;
    return numeric;
  }

  private normalizeUSStock(raw: IndmoneyRawUSStock): USStockHolding {
    return {
      broker: this.name,
      symbol: raw.symbol,
      name: raw.companyName || raw.name || raw.symbol,
      quantity: raw.quantity,
      averagePriceUSD: raw.averagePriceUsd ?? raw.avgPriceUsd ?? 0,
      currentPriceUSD: raw.currentPriceUsd ?? raw.ltpUsd ?? 0,
      investedValueINR: raw.investedValueInr ?? raw.investedAmountInr ?? 0,
      currentValueINR: raw.currentValueInr,
      pnlINR: raw.pnlInr ?? (raw.currentValueInr - (raw.investedValueInr ?? raw.investedAmountInr ?? 0)),
    };
  }

  private normalizeGold(raw: IndmoneyRawGold): GoldHolding {
    const investedValue = raw.investedValue ?? raw.investedAmount ?? 0;
    return {
      broker: this.name,
      type: this.mapGoldType(raw.type || raw.goldType),
      quantityGrams: raw.quantityGrams ?? raw.grams,
      units: raw.units,
      investedValue,
      currentValue: raw.currentValue,
      pnl: raw.pnl ?? raw.returns ?? (raw.currentValue - investedValue),
    };
  }

  private mapOrderType(type: string): "MARKET" | "LIMIT" | "SL" | "SLM" {
    const t = type.toUpperCase();
    if (t.includes("MARKET") || t === "MKT") return "MARKET";
    if (t.includes("LIMIT") || t === "LMT") return "LIMIT";
    if (t === "SL") return "SL";
    if (t === "SLM" || t === "SL-M") return "SLM";
    return "MARKET";
  }

  private mapOrderStatus(status: string): "OPEN" | "COMPLETE" | "CANCELLED" | "REJECTED" {
    const s = status.toUpperCase();
    if (s.includes("COMPLETE") || s.includes("EXECUTED") || s.includes("SUCCESS")) return "COMPLETE";
    if (s.includes("CANCEL")) return "CANCELLED";
    if (s.includes("REJECT") || s.includes("FAIL")) return "REJECTED";
    return "OPEN";
  }

  private mapGoldType(type?: string): "DIGITAL_GOLD" | "SOVEREIGN_GOLD_BOND" | "GOLD_ETF" {
    if (!type) return "DIGITAL_GOLD";
    const t = type.toUpperCase();
    if (t.includes("SGB") || t.includes("SOVEREIGN")) return "SOVEREIGN_GOLD_BOND";
    if (t.includes("ETF")) return "GOLD_ETF";
    return "DIGITAL_GOLD";
  }
}
