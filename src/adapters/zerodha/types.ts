// Raw response types from Zerodha Kite OMS API

export interface KiteApiResponse<T> {
  status: "success" | "error";
  data: T;
  message?: string;
  error_type?: string;
}

export interface KiteRawHolding {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  t1_quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  close_price: number;
  product: string;
  collateral_quantity: number;
  collateral_type: string;
  day_change: number;
  day_change_percentage: number;
  instrument_token: number;
}

export interface KiteRawPosition {
  tradingsymbol: string;
  exchange: string;
  instrument_token: number;
  product: string;
  quantity: number;
  overnight_quantity: number;
  multiplier: number;
  average_price: number;
  close_price: number;
  last_price: number;
  value: number;
  pnl: number;
  m2m: number;
  unrealised: number;
  realised: number;
  buy_quantity: number;
  buy_price: number;
  buy_value: number;
  buy_m2m: number;
  sell_quantity: number;
  sell_price: number;
  sell_value: number;
  sell_m2m: number;
  day_buy_quantity: number;
  day_buy_price: number;
  day_buy_value: number;
  day_sell_quantity: number;
  day_sell_price: number;
  day_sell_value: number;
}

export interface KitePositionsData {
  net: KiteRawPosition[];
  day: KiteRawPosition[];
}

export interface KiteRawOrder {
  order_id: string;
  exchange_order_id: string | null;
  parent_order_id: string | null;
  status: string;
  status_message: string | null;
  status_message_raw: string | null;
  order_timestamp: string;
  exchange_update_timestamp: string | null;
  exchange_timestamp: string | null;
  variety: string;
  modified: boolean;
  exchange: string;
  tradingsymbol: string;
  instrument_token: number;
  order_type: string;
  transaction_type: string;
  validity: string;
  product: string;
  quantity: number;
  disclosed_quantity: number;
  price: number;
  trigger_price: number;
  average_price: number;
  filled_quantity: number;
  pending_quantity: number;
  cancelled_quantity: number;
  tag: string;
}

export interface KiteRawQuote {
  instrument_token: number;
  timestamp: string;
  last_trade_time: string;
  last_price: number;
  last_quantity: number;
  buy_quantity: number;
  sell_quantity: number;
  volume: number;
  average_price: number;
  oi: number;
  oi_day_high: number;
  oi_day_low: number;
  net_change: number;
  lower_circuit_limit: number;
  upper_circuit_limit: number;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  depth: {
    buy: Array<{ price: number; quantity: number; orders: number }>;
    sell: Array<{ price: number; quantity: number; orders: number }>;
  };
}

export interface KiteRawSearchResult {
  instrument_token: number;
  tradingsymbol: string;
  name: string;
  exchange: string;
  instrument_type: string;
  last_price: number;
}

// Coin (Mutual Funds) types
export interface CoinRawMutualFund {
  scheme_name: string;
  amc: string;
  folio: string;
  units: number;
  nav: number;
  average_price: number;
  invested: number;
  current_value: number;
  pnl: number;
  pnl_percentage: number;
  xirr?: number;
  sip_active: boolean;
  category: string;
}
