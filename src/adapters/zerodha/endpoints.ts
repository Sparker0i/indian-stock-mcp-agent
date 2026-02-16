// Known Zerodha Kite OMS API endpoints
// These are intercepted from the Kite web app's XHR/fetch calls

export const KITE_ENDPOINTS = {
  holdings: "/oms/portfolio/holdings",
  positions: "/oms/portfolio/positions",
  orders: "/oms/orders",
  quote: "/oms/quote",
  search: "/oms/instruments",
  margins: "/oms/user/margins",
  profile: "/oms/user/profile",
} as const;

// Coin (Mutual Funds) endpoints
export const COIN_ENDPOINTS = {
  dashboard: "/coin/api/v1/dashboard",
  holdings: "/coin/api/v1/mf/holdings",
  orders: "/coin/api/v1/mf/orders",
  sips: "/coin/api/v1/mf/sips",
} as const;

export const KITE_URLS = {
  base: "https://kite.zerodha.com",
  login: "https://kite.zerodha.com/",
  holdings: "https://kite.zerodha.com/holdings",
  positions: "https://kite.zerodha.com/positions",
  orders: "https://kite.zerodha.com/orders",
  dashboard: "https://kite.zerodha.com/dashboard",
  coin: "https://coin.zerodha.com/dashboard",
} as const;

// URL patterns for network interception
export const KITE_PATTERNS = {
  holdings: /kite\.zerodha\.com\/oms\/portfolio\/holdings/,
  positions: /kite\.zerodha\.com\/oms\/portfolio\/positions/,
  orders: /kite\.zerodha\.com\/oms\/orders/,
  quote: /kite\.zerodha\.com\/oms\/quote/,
  search: /kite\.zerodha\.com\/oms\/instruments/,
  coinHoldings: /coin\.zerodha\.com.*\/mf\/holdings/,
  coinDashboard: /coin\.zerodha\.com.*\/dashboard/,
} as const;
