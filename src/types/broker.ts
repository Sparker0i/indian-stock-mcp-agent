import type {
  Holding,
  Position,
  Order,
  MutualFundHolding,
  USStockHolding,
  GoldHolding,
} from "./portfolio.js";

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  instrumentType: string;
}

export interface Quote {
  symbol: string;
  exchange: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

export type BrokerName = "groww" | "zerodha" | "indmoney";

export interface BrokerFeatures {
  stocks: boolean;
  fno: boolean;
  mutualFunds: boolean;
  usStocks: boolean;
  gold: boolean;
}

export interface BrokerAdapter {
  readonly name: BrokerName;
  readonly displayName: string;
  readonly loginUrl: string;
  readonly dashboardUrl: string;
  readonly supportedFeatures: BrokerFeatures;

  connect(method: "browser_login" | "cookies", cookies?: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getSessionAge(): number;

  getHoldings(): Promise<Holding[]>;
  getPositions(): Promise<Position[]>;
  getOrders(): Promise<Order[]>;
  getMutualFunds(): Promise<MutualFundHolding[]>;
  getUSStocks(): Promise<USStockHolding[]>;
  getGold(): Promise<GoldHolding[]>;
  getFnOPositions(): Promise<Position[]>;

  searchStock(query: string): Promise<SearchResult[]>;
  getQuote(symbol: string): Promise<Quote>;
}
