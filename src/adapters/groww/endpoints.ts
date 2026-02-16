// Known Groww internal API endpoints
// These are discovered via network interception from the Groww SPA
// Exact paths may change — use learn_broker_navigation to recalibrate

export const GROWW_URLS = {
  base: "https://groww.in",
  login: "https://groww.in/login",
  holdings: "https://groww.in/stocks/user/holdings",
  mfDashboard: "https://groww.in/mutual-funds/user/investments",
  orders: "https://groww.in/dashboard/orders",
  usStocks: "https://groww.in/us-stocks/portfolio",
  gold: "https://groww.in/gold/dashboard",
} as const;

// URL patterns for network interception
// These patterns match Groww's internal API calls
export const GROWW_PATTERNS = {
  // Stock holdings - NEW endpoint discovered 2026-02-13
  holdings: /groww\.in\/v2\/api\/stocks\/holdings\/all/i,
  // Mutual funds - aggregator dashboard endpoint
  mutualFunds: /groww\.in\/v1\/api\/aggregator\/v4\/dashboard/i,
  // Legacy/fallback patterns
  positions: /groww\.in.*\/(positions|open-position)/i,
  orders: /groww\.in.*\/(orders|order-book)/i,
  usStocks: /groww\.in.*\/(us-stock|us_stock).*(portfolio|holding)/i,
  gold: /groww\.in.*\/(gold|sgb).*(dashboard|holding)/i,
  search: /groww\.in.*\/(search|entity)/i,
  quote: /groww\.in.*\/(quote|stock-detail|ltp)/i,
} as const;
