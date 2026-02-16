// DOM selectors for INDmoney web app (fallback when network interception fails)

export const INDMONEY_SELECTORS = {
  // Login
  phoneInput: "input[type='tel'], input[placeholder*='phone'], input[placeholder*='mobile']",
  otpInput: "input[type='tel'][maxlength='1'], input[type='number']",
  submitButton: "button[type='submit']",

  // Dashboard
  dashboardContainer: "[class*='dashboard'], [class*='portfolio']",
  totalValue: "[class*='total-value'], [class*='portfolio-value']",

  // Indian Stocks
  stocksContainer: "[class*='stock-portfolio'], [class*='equity']",
  stockRow: "[class*='stock-row'], [class*='holding-row']",
  stockSymbol: "[class*='symbol'], [class*='stock-name']",
  stockQuantity: "[class*='quantity'], [class*='qty']",
  stockValue: "[class*='value'], [class*='current-value']",
  stockPnl: "[class*='pnl'], [class*='profit']",

  // Mutual Funds
  mfContainer: "[class*='mutual-fund'], [class*='mf-portfolio']",
  mfRow: "[class*='mf-row'], [class*='fund-row']",
  mfSchemeName: "[class*='scheme-name'], [class*='fund-name']",
  mfValue: "[class*='current-value']",

  // US Stocks
  usStocksContainer: "[class*='us-stock']",
  usStockRow: "[class*='us-stock-row']",

  // Gold
  goldContainer: "[class*='gold']",
  goldRow: "[class*='gold-row'], [class*='gold-holding']",

  // General
  loader: "[class*='loader'], [class*='loading'], [class*='skeleton']",
  noData: "[class*='no-data'], [class*='empty']",
  errorMessage: "[class*='error']",
} as const;
