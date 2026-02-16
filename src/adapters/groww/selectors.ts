// DOM selectors for Groww web app (fallback when network interception fails)

export const GROWW_SELECTORS = {
  // Login page
  loginEmailInput: "input[type='email'], input[type='text'][name='email']",
  loginPasswordInput: "input[type='password']",
  loginSubmit: "button[type='submit']",
  otpInput: "input[type='tel'], input[type='number']",

  // Dashboard / Holdings
  holdingsContainer: "[class*='holdings'], [class*='investment']",
  holdingsRow: "[class*='holding-row'], [class*='stock-row'], tr[class*='holding']",
  stockName: "[class*='stock-name'], [class*='company-name']",
  quantity: "[class*='quantity']",
  avgPrice: "[class*='avg-price'], [class*='average']",
  currentPrice: "[class*='ltp'], [class*='current-price']",
  pnl: "[class*='pnl'], [class*='profit-loss']",

  // Mutual Funds
  mfContainer: "[class*='mutual-fund'], [class*='mf-dashboard']",
  mfRow: "[class*='mf-row'], [class*='fund-row']",
  schemeName: "[class*='scheme-name'], [class*='fund-name']",
  mfReturns: "[class*='returns'], [class*='xirr']",

  // US Stocks
  usStocksContainer: "[class*='us-stock']",
  usStockRow: "[class*='us-stock-row']",

  // Gold
  goldContainer: "[class*='gold']",
  goldRow: "[class*='gold-row']",

  // General
  searchInput: "input[class*='search'], input[placeholder*='Search']",
  searchResults: "[class*='search-result']",
  noData: "[class*='no-data'], [class*='empty-state']",
  loader: "[class*='loader'], [class*='loading'], [class*='spinner']",

  // Navigation
  navBar: "nav, [class*='nav-bar']",
  profileMenu: "[class*='profile'], [class*='user-menu']",
} as const;
