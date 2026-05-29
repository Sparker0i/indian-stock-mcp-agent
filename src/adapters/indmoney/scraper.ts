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

// Parse INDmoney's rendered amount strings → number. Handles Indian abbreviations:
//   "₹500"      →        500
//   "₹54.33K"   →     54,330        (K = 1e3)
//   "₹2.29L"    →    229,000        (L = 1e5, lakh)
//   "₹1.5Cr"    → 15,000,000        (Cr = 1e7, crore)
//   "₹-2.11K"   →     -2,110
// Returns 0 on empty/unparseable input.
function parseAmount(s: string | undefined): number {
  if (!s) return 0;
  const stripped = String(s).replace(/[₹,\s▲▼]/g, "");
  const m = stripped.match(/^(-?\d*\.?\d+)\s*(Cr|L|K)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]!);
  if (!Number.isFinite(n)) return 0;
  const unit = (m[2] ?? "").toLowerCase();
  const mult = unit === "cr" ? 1e7 : unit === "l" ? 1e5 : unit === "k" ? 1e3 : 1;
  return n * mult;
}

// Parse signed-percent strings like "▲99.41%", "▼0.74%", "11.84%" → number.
// ▼ marks the value as negative; "▲" and bare strings are positive.
function parsePercent(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const isNeg = s.includes("▼") || /^-/.test(s.trim());
  const cleaned = s.replace(/[▲▼\s%+]/g, "").replace(/^-/, "");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return undefined;
  return isNeg ? -Math.abs(n) : n;
}

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
    this.interceptor.addPattern("usStocksFx", INDMONEY_PATTERNS.usStocksFx);
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

    try {
      await page.goto(INDMONEY_URLS.indianStocks, { waitUntil: "networkidle", timeout: 30000 });
    } catch (err) {
      // INDmoney moved Indian stocks to indstocks.com (~May 2026).
      // The old URL returns ERR_ABORTED. Return empty instead of crashing.
      logger.warn(`INDmoney: Indian stocks page navigation failed (likely deprecated URL): ${err}`);
      return [];
    }
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
    this.interceptor.clearPattern("usStocksFx");

    await page.goto(INDMONEY_URLS.usStocks, { waitUntil: "networkidle", timeout: 30000 });
    await randomDelay(1000, 2000);

    // FX rate is loaded by the same page via account/basic; capture it so the
    // normalizer can convert USD → INR.
    let fxRate: number | undefined;
    for (const cap of this.interceptor.getCaptures("usStocksFx")) {
      const body = cap.body as { dollar_to_rupee?: number } | undefined;
      if (body && typeof body.dollar_to_rupee === "number") {
        fxRate = body.dollar_to_rupee;
        break;
      }
    }

    for (const pattern of ["usStocksApi", "usStocks"]) {
      const captures = this.interceptor.getCaptures(pattern);
      for (const capture of captures) {
        const stocks = this.extractUSStocks(capture.body);
        if (stocks.length > 0) {
          if (fxRate !== undefined) {
            for (const s of stocks) s.fxRate = fxRate;
          }
          logger.info(`INDmoney: Captured ${stocks.length} US stocks via ${pattern} (fx=${fxRate ?? "n/a"})`);
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

    // Real INDmoney shape (calibrated 2026-05-02): { success, data: { funds: [...cards] } }
    // where each card is a render-shaped object with text fields like
    // column1.subTitle.text = "₹500", column3.values[i].title.text = "XIRR".
    const obj = body as IndmoneyMutualFundsResponse & { data?: { funds?: unknown[] } };
    const funds = obj.data?.funds;
    if (Array.isArray(funds) && funds.length > 0 && this.looksLikeFundCard(funds[0])) {
      return funds.map((c) => this.parseFundCard(c)).filter((f): f is IndmoneyRawMutualFund => f !== null);
    }

    return obj.mutualFunds || obj.investments || obj.holdings || [];
  }

  private extractUSStocks(body: unknown): IndmoneyRawUSStock[] {
    if (Array.isArray(body)) return body as IndmoneyRawUSStock[];

    const obj = body as Record<string, unknown>;

    // New INDmoney shape (recalibrated 2026-05-29):
    // /us-stock-broker/us/portfolio/equity/summary returns:
    // { demat_summary: { asset_summary: { scrip_details: [...] } } }
    const dematSummary = obj.demat_summary as Record<string, unknown> | undefined;
    const assetSummary = dematSummary?.asset_summary as Record<string, unknown> | undefined;
    const scripDetails = assetSummary?.scrip_details as Array<Record<string, unknown>> | undefined;

    if (Array.isArray(scripDetails)) {
      return scripDetails
        .filter((s) => {
          const h = s.holdings as Record<string, unknown> | undefined;
          const agg = s.aggregated as Record<string, unknown> | undefined;
          const qty = Number(h?.quantity ?? agg?.quantity ?? 0);
          const excluded = h?.exclude_from_holdings_summary === true ||
                           agg?.exclude_from_holdings_summary === true;
          return qty > 0 && !excluded;
        })
        .map((s) => {
          const meta = s.metadata as Record<string, unknown>;
          const h = s.holdings as Record<string, unknown>;
          return {
            ticker: String(meta.symbol ?? meta.ind_key ?? ""),
            name: String(meta.name ?? ""),
            quantity: Number(h.quantity ?? 0),
            avg_price: Number(h.avg_price ?? 0),
            live_price: Number(meta.live_price ?? 0),
            invested_amount: Number(h.invested_amount ?? 0),
            current_value: Number(h.current_value ?? 0),
            total_profit_loss: Number(h.overall_pnl ?? 0),
            total_percent_change: Number(h.overall_pnl_percentage ?? 0),
            todays_profit_loss: Number(h.day_pnl ?? 0),
            todays_percent_change: Number(h.day_pnl_percentage ?? 0),
            sector: String(meta.sector ?? ""),
            market_cap: String(meta.market_cap ?? ""),
          } as IndmoneyRawUSStock;
        });
    }

    // Legacy fallback (pre-2026-05-29):
    // { data: [ { ticker, name, quantity, avg_price, live_price, ... }, ... ] }
    if (Array.isArray(obj.data)) return obj.data as IndmoneyRawUSStock[];

    const legacy = obj as IndmoneyUSStocksResponse;
    return legacy.usStocks || legacy.holdings || [];
  }

  // --- INDmoney mutual-fund card parsing ---
  // The /mf-tracking-ext/v1/users/portfolio/funds endpoint returns funds as
  // mobile UI cards. We extract by looking up cells by their visible label.

  private looksLikeFundCard(card: unknown): boolean {
    if (!card || typeof card !== "object") return false;
    const c = card as Record<string, unknown>;
    return "title" in c && "column1" in c && "column2" in c;
  }

  private parseFundCard(card: unknown): IndmoneyRawMutualFund | null {
    if (!card || typeof card !== "object") return null;
    const c = card as Record<string, unknown>;

    const schemeName = this.readText((c.title as Record<string, unknown> | undefined)?.text);
    if (!schemeName) return null;

    const cells = this.flattenCardCells(c);
    const byLabel = (label: RegExp): string | undefined => {
      const cell = cells.find((x) => label.test(x.label));
      return cell?.value;
    };

    const investedValue = parseAmount(byLabel(/^Invested$/i));
    const currentValue = parseAmount(byLabel(/^Current Value$/i));
    const returns = parseAmount(byLabel(/^Gain\/?\s?Loss$/i));
    const xirr = parsePercent(byLabel(/^XIRR$/i));
    const units = parseAmount(byLabel(/^Units/i));

    const returnsPercent = investedValue > 0 ? (returns / investedValue) * 100 : undefined;

    return {
      schemeName,
      units: units ?? 0,
      nav: 0, // not exposed in card payload
      investedValue,
      currentValue,
      returns,
      returnsPercentage: returnsPercent,
      xirr,
    };
  }

  private flattenCardCells(card: Record<string, unknown>): Array<{ label: string; value: string }> {
    const out: Array<{ label: string; value: string }> = [];
    for (const k of ["column1", "column2"]) {
      const col = card[k] as Record<string, unknown> | undefined;
      const label = this.readText((col?.title as Record<string, unknown> | undefined)?.text);
      const value = this.readText((col?.subTitle as Record<string, unknown> | undefined)?.text);
      if (label) out.push({ label, value });
    }
    const col3 = card.column3 as { values?: unknown[] } | undefined;
    if (col3 && Array.isArray(col3.values)) {
      for (const v of col3.values) {
        const cell = v as Record<string, unknown>;
        const labelRaw = this.readText((cell.title as Record<string, unknown> | undefined)?.text);
        const label = labelRaw.replace(/<[^>]+>/g, "").trim(); // strip <span> wrappers
        const value = this.readText((cell.subTitle as Record<string, unknown> | undefined)?.text);
        if (label) out.push({ label, value });
      }
    }
    return out;
  }

  private readText(v: unknown): string {
    return typeof v === "string" ? v : "";
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
