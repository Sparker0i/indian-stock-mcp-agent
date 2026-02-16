// Known INDmoney internal API endpoints
// Discovered via network interception — exact paths may change

export const INDMONEY_URLS = {
  base: "https://www.indmoney.com",
  login: "https://www.indmoney.com/",
  dashboard: "https://www.indmoney.com/dashboard",
  indianStocks: "https://www.indmoney.com/indian-stocks/portfolio",
  mutualFunds: "https://www.indmoney.com/mutual-funds/portfolio",
  usStocks: "https://www.indmoney.com/us-stocks/portfolio",
  gold: "https://www.indmoney.com/gold",
  orders: "https://www.indmoney.com/orders",
} as const;

// URL patterns for network interception
export const INDMONEY_PATTERNS = {
  // Dashboard
  dashboardSummary: /indmoney\.com.*\/(dashboard|portfolio-summary)/i,

  // Indian stocks
  indianStocks: /indmoney\.com.*\/(indian-stock|equity).*(portfolio|holding)/i,
  indianStocksApi: /api.*indmoney\.com.*\/(stock|equity|holding)/i,

  // Mutual Funds
  mutualFunds: /indmoney\.com.*\/(mutual-fund|mf).*(portfolio|holding)/i,
  mutualFundsApi: /api.*indmoney\.com.*\/(mutual-fund|mf)/i,

  // US Stocks
  usStocks: /indmoney\.com.*\/(us-stock).*(portfolio|holding)/i,
  usStocksApi: /api.*indmoney\.com.*\/us-stock/i,

  // Gold
  gold: /indmoney\.com.*\/(gold|sgb).*(holding|portfolio|dashboard)/i,
  goldApi: /api.*indmoney\.com.*\/gold/i,

  // Orders
  orders: /indmoney\.com.*\/order/i,

  // Generic portfolio/investment data
  portfolio: /indmoney\.com.*\/(portfolio|investment|wealth)/i,
} as const;
