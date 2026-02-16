// Raw response types from Groww internal APIs

export interface GrowwApiResponse<T> {
  success?: boolean;
  data?: T;
  [key: string]: unknown;
}

// Stock holdings - NEW API structure (v2/api/stocks/holdings/all)
export interface GrowwRawHolding {
  symbolData: {
    symbolIsin: string;
    companyShortName: string;
    scripCode?: string;
    nseScripCode?: string;
    bseScripCode?: string;
    tradingSymbol: string;
    nseTradingSymbol?: string;
    bseTradingSymbol?: string;
    exchange: string;
    equityType?: string;
  };
  holdingQty: number;
  holdingAvgPrice: number; // in paise! divide by 100
  netQty: number;
  netPrice: number; // in paise! divide by 100
  positionQty?: number;
  positionNetPrice?: number;
}

export interface GrowwHoldingsResponse {
  holdings: GrowwRawHolding[];
  [key: string]: unknown;
}

// Positions
export interface GrowwRawPosition {
  tradingSymbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  ltp: number;
  pnl: number;
  product: string;
  segment?: string;
  instrumentType?: string;
  buyQuantity?: number;
  sellQuantity?: number;
  buyPrice?: number;
  sellPrice?: number;
}

export interface GrowwPositionsResponse {
  positions?: GrowwRawPosition[];
  [key: string]: unknown;
}

// Orders
export interface GrowwRawOrder {
  orderId: string;
  tradingSymbol: string;
  exchange: string;
  transactionType: string;
  orderType: string;
  product: string;
  quantity: number;
  price: number;
  triggerPrice?: number;
  averagePrice?: number;
  status: string;
  orderTimestamp: string;
  filledQuantity?: number;
}

export interface GrowwOrdersResponse {
  orders?: GrowwRawOrder[];
  orderBook?: GrowwRawOrder[];
  [key: string]: unknown;
}

// Mutual Funds - aggregator/v4/dashboard
export interface GrowwRawMutualFund {
  schemeCode: string;
  folioNumber: string;
  units: number;
  amountInvested: number;
  averageNav: number;
  currentNav: number;
  currentValue: number;
  schemeName: string;
  fundName?: string;
  isin?: string;
  xirr?: number;
  source?: string;
  folioType?: string;
  planType?: string;
  schemeType?: string;
  sipDetails?: {
    hasActiveSip: boolean;
    activeSipCount: number;
  };
  dayChange?: {
    oneDayReturn: number;
    percentage: number;
  };
}

export interface GrowwMutualFundsResponse {
  investedAmount?: number;
  currentValue?: number;
  xirr?: number;
  holdings: GrowwRawMutualFund[];
  [key: string]: unknown;
}

// US Stocks
export interface GrowwRawUSStock {
  symbol: string;
  companyName: string;
  quantity: number;
  averagePriceUsd: number;
  currentPriceUsd: number;
  investedValueInr: number;
  currentValueInr: number;
  pnlInr: number;
  pnlPercentage?: number;
}

export interface GrowwUSStocksResponse {
  usStocks?: GrowwRawUSStock[];
  holdings?: GrowwRawUSStock[];
  [key: string]: unknown;
}

// Gold
export interface GrowwRawGold {
  type: string;
  quantityGrams?: number;
  units?: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
}

export interface GrowwGoldResponse {
  gold?: GrowwRawGold[];
  goldHoldings?: GrowwRawGold[];
  [key: string]: unknown;
}

// Search
export interface GrowwRawSearchResult {
  symbol?: string;
  tradingSymbol?: string;
  companyName?: string;
  name?: string;
  exchange?: string;
  instrumentType?: string;
  searchId?: string;
  entityType?: string;
}
