// Known INDmoney internal API endpoints
// Discovered via network interception — exact paths may change

export const INDMONEY_URLS = {
  base: "https://www.indmoney.com",
  login: "https://www.indmoney.com/",
  dashboard: "https://www.indmoney.com/dashboard",
  // Indian stocks moved to indstocks.com (separate domain) as of ~May 2026.
  // This URL now returns ERR_ABORTED. Kept for reference; scraper handles gracefully.
  indianStocks: "https://www.indmoney.com/indian-stocks/portfolio",
  mutualFunds: "https://www.indmoney.com/investments/mutual-fund/my-funds",
  usStocks: "https://www.indmoney.com/investments/us-stocks/my-us-stocks",
  gold: "https://www.indmoney.com/gold",
  orders: "https://www.indmoney.com/orders",
} as const;

// URL patterns for network interception. Calibrated 2026-05-02 from a recording
// of the live INDmoney web app — see recordings/indmoney/ for the source.
export const INDMONEY_PATTERNS = {
  dashboardSummary: /indmoney\.com.*\/(dashboard|portfolio-summary)/i,

  // Indian stocks — uncalibrated (page not visited in 2026-05-02 recording).
  indianStocks: /indmoney\.com.*\/(indian-stock|equity).*(portfolio|holding)/i,
  indianStocksApi: /apixt.*indmoney\.com.*\/(stock|equity|holding)/i,

  // Mutual Funds — calibrated.
  mutualFunds: /indmoney\.com\/investments\/mutual-fund\/my-funds/i,
  mutualFundsApi: /apixt-iw\.indmoney\.com\/mf-tracking-ext\/v1\/users\/portfolio\/funds/i,

  // US Stocks — recalibrated 2026-05-29.
  // INDmoney migrated from /us-stocks-ext/ to /us-stock-broker/ endpoints.
  usStocks: /indmoney\.com\/investments\/us-stocks\/my-us-stocks/i,
  usStocksApi: /apixt-fz\.indmoney\.com\/us-stock-broker\/us\/portfolio\/equity\/summary/i,
  usStocksFx: /apixt-iw\.indmoney\.com\/ind-investment\/api\/v4\/user\/basic/i,

  // Gold — uncalibrated.
  gold: /indmoney\.com.*\/(gold|sgb).*(holding|portfolio|dashboard)/i,
  goldApi: /apixt.*indmoney\.com.*\/gold/i,

  orders: /indmoney\.com.*\/order/i,
  portfolio: /apixt.*indmoney\.com.*\/(portfolio|investment|wealth)/i,
} as const;
