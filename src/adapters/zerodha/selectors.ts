// DOM selectors for Zerodha Kite web app (fallback when network interception fails)

export const KITE_SELECTORS = {
  // Login page
  loginUserId: "input#userid",
  loginPassword: "input#password",
  loginSubmit: "button[type='submit']",
  loginTotpInput: "input[type='text'][autocomplete='one-time-code']",

  // Holdings page
  holdingsTable: ".holdings .data-table",
  holdingsRow: ".holdings .data-table tbody tr",
  holdingsSymbol: ".data-table .instrument",
  holdingsQuantity: ".data-table td:nth-child(2)",
  holdingsAvgPrice: ".data-table td:nth-child(3)",
  holdingsLTP: ".data-table td:nth-child(4)",
  holdingsPnL: ".data-table td:nth-child(7)",

  // Positions page
  positionsTable: ".positions .data-table",
  positionsRow: ".positions .data-table tbody tr",

  // Orders page
  ordersTable: ".orders .data-table",
  ordersRow: ".orders .data-table tbody tr",

  // General
  searchInput: "input.search",
  searchResults: ".omnisearch-results .result",
  noData: ".no-data",
  loadingSpinner: ".loading",

  // Dashboard
  dashboardNav: ".app-nav",
  profileIcon: ".user-menu",
} as const;
