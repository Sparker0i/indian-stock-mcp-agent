// Raw response types from INDmoney internal APIs

export interface IndmoneyApiResponse<T> {
  success?: boolean;
  data?: T;
  result?: T;
  [key: string]: unknown;
}

// Indian Stock holdings
export interface IndmoneyRawHolding {
  symbol?: string;
  tradingSymbol?: string;
  isin: string;
  companyName: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  ltp?: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
  exchange?: string;
  broker?: string;
}

export interface IndmoneyHoldingsResponse {
  holdings?: IndmoneyRawHolding[];
  stocks?: IndmoneyRawHolding[];
  [key: string]: unknown;
}

// Mutual Funds
export interface IndmoneyRawMutualFund {
  schemeName: string;
  schemeCode?: string;
  amcName?: string;
  amc?: string;
  folioNumber?: string;
  folio?: string;
  units: number;
  nav: number;
  investedAmount?: number;
  investedValue?: number;
  currentValue: number;
  returns?: number;
  pnl?: number;
  returnsPercentage?: number;
  pnlPercentage?: number;
  xirr?: number;
  sipActive?: boolean;
  isSipActive?: boolean;
  category?: string;
  subCategory?: string;
}

export interface IndmoneyMutualFundsResponse {
  mutualFunds?: IndmoneyRawMutualFund[];
  investments?: IndmoneyRawMutualFund[];
  holdings?: IndmoneyRawMutualFund[];
  [key: string]: unknown;
}

// US Stocks
export interface IndmoneyRawUSStock {
  symbol: string;
  companyName?: string;
  name?: string;
  quantity: number;
  averagePriceUsd?: number;
  avgPriceUsd?: number;
  currentPriceUsd?: number;
  ltpUsd?: number;
  investedValueInr?: number;
  investedAmountInr?: number;
  currentValueInr: number;
  pnlInr?: number;
  pnlPercentage?: number;
}

export interface IndmoneyUSStocksResponse {
  usStocks?: IndmoneyRawUSStock[];
  holdings?: IndmoneyRawUSStock[];
  [key: string]: unknown;
}

// Gold
export interface IndmoneyRawGold {
  type?: string;
  goldType?: string;
  quantityGrams?: number;
  grams?: number;
  units?: number;
  investedValue?: number;
  investedAmount?: number;
  currentValue: number;
  pnl?: number;
  returns?: number;
}

export interface IndmoneyGoldResponse {
  gold?: IndmoneyRawGold[];
  goldHoldings?: IndmoneyRawGold[];
  [key: string]: unknown;
}

// Orders
export interface IndmoneyRawOrder {
  orderId: string;
  symbol?: string;
  tradingSymbol?: string;
  exchange?: string;
  transactionType: string;
  orderType: string;
  product?: string;
  quantity: number;
  price: number;
  triggerPrice?: number;
  status: string;
  timestamp?: string;
  orderTime?: string;
}

export interface IndmoneyOrdersResponse {
  orders?: IndmoneyRawOrder[];
  [key: string]: unknown;
}
