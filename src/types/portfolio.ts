export interface Holding {
  broker: string;
  symbol: string;
  isin: string;
  name: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  exchange: string;
  assetType: "EQUITY" | "ETF";
}

export interface Position {
  broker: string;
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  product: string;
  instrumentType: "EQ" | "FUT" | "CE" | "PE";
}

export interface MutualFundHolding {
  broker: string;
  schemeName: string;
  amcName: string;
  folioNumber: string;
  units: number;
  nav: number;
  investedValue: number;
  currentValue: number;
  returns: number;
  returnsPercent: number;
  xirr?: number;
  sipActive: boolean;
  category: string;
}

export interface USStockHolding {
  broker: string;
  symbol: string;
  name: string;
  quantity: number;
  averagePriceUSD: number;
  currentPriceUSD: number;
  investedValueINR: number;
  currentValueINR: number;
  pnlINR: number;
}

export interface GoldHolding {
  broker: string;
  type: "DIGITAL_GOLD" | "SOVEREIGN_GOLD_BOND" | "GOLD_ETF";
  quantityGrams?: number;
  units?: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
}

export interface Order {
  broker: string;
  orderId: string;
  symbol: string;
  exchange: string;
  type: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT" | "SL" | "SLM";
  product: string;
  quantity: number;
  price: number;
  triggerPrice?: number;
  status: "OPEN" | "COMPLETE" | "CANCELLED" | "REJECTED";
  timestamp: string;
}

export interface PortfolioSummary {
  totalInvestedValue: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  assetAllocation: {
    equity: number;
    mutualFunds: number;
    usStocks: number;
    gold: number;
    fno: number;
  };
  brokerWise: Array<{
    broker: string;
    investedValue: number;
    currentValue: number;
    pnl: number;
  }>;
}
