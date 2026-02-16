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
import { GrowwScraper } from "./scraper.js";
import type {
  GrowwRawHolding,
  GrowwRawPosition,
  GrowwRawOrder,
  GrowwRawMutualFund,
  GrowwRawUSStock,
  GrowwRawGold,
} from "./types.js";
import { retry } from "../../utils/retry.js";

export class GrowwAdapter extends BaseAdapter {
  readonly name: BrokerName = "groww";
  readonly displayName = "Groww";
  readonly loginUrl = "https://groww.in/login";
  readonly dashboardUrl = "https://groww.in/dashboard/investments";
  readonly supportedFeatures: BrokerFeatures = {
    stocks: true,
    fno: true,
    mutualFunds: true,
    usStocks: true,
    gold: true,
  };

  private scraper: GrowwScraper;
  private scraperAttached = false;

  constructor() {
    super();
    this.scraper = new GrowwScraper();
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
      return raw.map((p) => this.normalizePosition(p));
    });
  }

  override async getFnOPositions(): Promise<Position[]> {
    this.ensureConnected();
    await this.ensureScraper();
    return retry(async () => {
      const page = await this.getPage();
      const raw = await this.scraper.fetchPositions(page);
      const fno = raw.filter(
        (p) => p.segment === "FNO" || p.instrumentType === "FUT" || p.instrumentType === "OPT",
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

  override async searchStock(query: string): Promise<SearchResult[]> {
    this.ensureConnected();
    await this.ensureScraper();
    const page = await this.getPage();
    const raw = await this.scraper.searchStocks(page, query);
    return raw.map((r) => ({
      symbol: r.symbol || r.tradingSymbol || "",
      name: r.companyName || r.name || "",
      exchange: r.exchange || "NSE",
      instrumentType: r.instrumentType || r.entityType || "EQ",
    }));
  }

  override async getQuote(symbol: string): Promise<Quote> {
    this.ensureConnected();
    throw new Error(`Groww: getQuote for ${symbol} — use learn_broker_navigation to discover quote endpoints first`);
  }

  // --- Normalizers ---

  private normalizeHolding(raw: GrowwRawHolding): Holding {
    // Prices are in paise, convert to rupees
    const avgPrice = raw.holdingAvgPrice / 100;
    const quantity = raw.holdingQty;
    const investedValue = quantity * avgPrice;

    // TODO: Need LTP for current price - might need separate API call or from mini-portfolio
    const currentPrice = avgPrice; // Placeholder - will be 0 P&L until we get LTP
    const currentValue = quantity * currentPrice;
    const pnl = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    return {
      broker: this.name,
      symbol: raw.symbolData.tradingSymbol || raw.symbolData.nseScripCode || raw.symbolData.scripCode || "",
      isin: raw.symbolData.symbolIsin,
      name: raw.symbolData.companyShortName,
      quantity,
      averagePrice: avgPrice,
      currentPrice,
      investedValue,
      currentValue,
      pnl,
      pnlPercent,
      exchange: raw.symbolData.exchange || "NSE",
      assetType: (raw.symbolData.equityType === "ETF" ? "ETF" : "EQUITY") as "EQUITY" | "ETF",
    };
  }

  private normalizePosition(raw: GrowwRawPosition): Position {
    return {
      broker: this.name,
      symbol: raw.tradingSymbol,
      exchange: raw.exchange,
      quantity: raw.quantity,
      averagePrice: raw.averagePrice,
      lastPrice: raw.ltp,
      pnl: raw.pnl,
      product: raw.product || "CNC",
      instrumentType: this.mapInstrumentType(raw.instrumentType),
    };
  }

  private normalizeOrder(raw: GrowwRawOrder): Order {
    return {
      broker: this.name,
      orderId: raw.orderId,
      symbol: raw.tradingSymbol,
      exchange: raw.exchange,
      type: raw.transactionType.toUpperCase() as "BUY" | "SELL",
      orderType: this.mapOrderType(raw.orderType),
      product: raw.product,
      quantity: raw.quantity,
      price: raw.price || raw.averagePrice || 0,
      triggerPrice: raw.triggerPrice,
      status: this.mapOrderStatus(raw.status),
      timestamp: raw.orderTimestamp,
    };
  }

  private normalizeMutualFund(raw: GrowwRawMutualFund): MutualFundHolding {
    const investedValue = raw.amountInvested;
    const currentValue = raw.currentValue;
    const returns = currentValue - investedValue;
    const returnsPercent = investedValue > 0 ? (returns / investedValue) * 100 : 0;

    // Extract AMC name from scheme name (e.g., "HDFC Large Cap Fund" -> "HDFC")
    const amcName = raw.fundName?.split(" ")[0] || raw.schemeName.split(" ")[0] || "";

    return {
      broker: this.name,
      schemeName: raw.schemeName,
      amcName,
      folioNumber: raw.folioNumber,
      units: raw.units,
      nav: raw.currentNav,
      investedValue,
      currentValue,
      returns,
      returnsPercent,
      xirr: raw.xirr,
      sipActive: raw.sipDetails?.hasActiveSip ?? false,
      category: raw.schemeType || raw.planType || "",
    };
  }

  private normalizeUSStock(raw: GrowwRawUSStock): USStockHolding {
    return {
      broker: this.name,
      symbol: raw.symbol,
      name: raw.companyName,
      quantity: raw.quantity,
      averagePriceUSD: raw.averagePriceUsd,
      currentPriceUSD: raw.currentPriceUsd,
      investedValueINR: raw.investedValueInr,
      currentValueINR: raw.currentValueInr,
      pnlINR: raw.pnlInr,
    };
  }

  private normalizeGold(raw: GrowwRawGold): GoldHolding {
    return {
      broker: this.name,
      type: this.mapGoldType(raw.type),
      quantityGrams: raw.quantityGrams,
      units: raw.units,
      investedValue: raw.investedValue,
      currentValue: raw.currentValue,
      pnl: raw.pnl,
    };
  }

  private mapInstrumentType(type?: string): "EQ" | "FUT" | "CE" | "PE" {
    if (!type) return "EQ";
    const t = type.toUpperCase();
    if (t === "FUT" || t === "FUTURE") return "FUT";
    if (t === "CE" || t === "CALL") return "CE";
    if (t === "PE" || t === "PUT") return "PE";
    return "EQ";
  }

  private mapOrderType(type: string): "MARKET" | "LIMIT" | "SL" | "SLM" {
    const t = type.toUpperCase();
    if (t === "MARKET" || t === "MKT") return "MARKET";
    if (t === "LIMIT" || t === "LMT") return "LIMIT";
    if (t === "SL") return "SL";
    if (t === "SLM" || t === "SL-M") return "SLM";
    return "MARKET";
  }

  private mapOrderStatus(status: string): "OPEN" | "COMPLETE" | "CANCELLED" | "REJECTED" {
    const s = status.toUpperCase();
    if (s.includes("COMPLETE") || s.includes("EXECUTED") || s.includes("FILLED")) return "COMPLETE";
    if (s.includes("CANCEL")) return "CANCELLED";
    if (s.includes("REJECT")) return "REJECTED";
    return "OPEN";
  }

  private mapGoldType(type: string): "DIGITAL_GOLD" | "SOVEREIGN_GOLD_BOND" | "GOLD_ETF" {
    const t = type.toUpperCase();
    if (t.includes("SGB") || t.includes("SOVEREIGN")) return "SOVEREIGN_GOLD_BOND";
    if (t.includes("ETF")) return "GOLD_ETF";
    return "DIGITAL_GOLD";
  }
}
