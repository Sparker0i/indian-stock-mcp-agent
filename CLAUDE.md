# Indian Broker MCP Server — CLAUDE.md

## Project Overview

Build an MCP (Model Context Protocol) server in **TypeScript** that connects to Indian broker/investment platforms (Groww, Zerodha Kite, INDmoney, and more) to provide a unified read-only view of a user's financial portfolio — Stocks, F&O, Mutual Funds, US Stocks, and Gold.

The server uses **Playwright browser automation exclusively** — no paid broker API subscriptions required. The user logs into their broker accounts via a visible Chrome browser, and the MCP server captures sessions and scrapes/intercepts data from the web apps.

The MCP server runs locally and is consumed by Claude Code, Claude Desktop, or any MCP-compatible client.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              MCP Client (Claude)                │
└──────────────────┬──────────────────────────────┘
                   │ STDIO / Streamable HTTP
┌──────────────────▼──────────────────────────────┐
│            MCP Server (this project)            │
│                                                  │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐ │
│  │  Groww     │  │  Zerodha  │  │  INDmoney   │ │
│  │  Adapter   │  │  Adapter  │  │  Adapter    │ │
│  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘ │
│        │              │               │          │
│  ┌─────▼──────────────▼───────────────▼───────┐ │
│  │         Playwright Browser Engine          │ │
│  │  (headed Chrome for login, headless after) │ │
│  │                                             │ │
│  │  • Network request interception (XHR/fetch) │ │
│  │  • DOM scraping (accessibility tree)        │ │
│  │  • Cookie/token extraction                  │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │       Unified Data Normalizer            │   │
│  │  (common types for all brokers)          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │       Session / Auth Manager             │   │
│  │  (in-memory, encrypted, auto-expiry)     │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology |
|---|---|
| Language | TypeScript (ES2022, Node16 modules) |
| MCP SDK | `@modelcontextprotocol/sdk` (latest) |
| Schema Validation | `zod` (v4, peer dependency of MCP SDK) |
| Browser Automation | `playwright` (Chromium channel: `chrome` — uses user's actual Chrome) |
| Build | `tsc` (TypeScript compiler) |
| Transport | STDIO (primary for Claude Desktop/Code), optionally Streamable HTTP |
| Encryption | Node.js `crypto` module (AES-256-GCM for session data) |
| Config | `.env` file via `dotenv` |

---

## Project Structure

```
indian-broker-mcp/
├── CLAUDE.md                   # This file
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── index.ts                # Entry point — MCP server setup + transport
│   ├── server.ts               # McpServer instance, tool/resource registration
│   │
│   ├── types/                  # Shared types
│   │   ├── portfolio.ts        # Unified portfolio types (Holding, Position, MutualFund, etc.)
│   │   ├── broker.ts           # BrokerAdapter interface
│   │   └── auth.ts             # Auth/session types
│   │
│   ├── adapters/               # Broker-specific adapters (each implements BrokerAdapter)
│   │   ├── base.ts             # Abstract base adapter class
│   │   ├── groww/
│   │   │   ├── index.ts        # Groww adapter
│   │   │   ├── scraper.ts      # Groww page navigation + network interception
│   │   │   ├── endpoints.ts    # Known internal API endpoints captured from Groww's SPA
│   │   │   ├── selectors.ts    # DOM selectors (fallback if network interception fails)
│   │   │   └── types.ts        # Groww-specific raw response types
│   │   ├── zerodha/
│   │   │   ├── index.ts        # Zerodha adapter
│   │   │   ├── scraper.ts      # Zerodha/Kite web page scraper + network interception
│   │   │   ├── endpoints.ts    # Known Kite internal API endpoints (OMS routes)
│   │   │   ├── selectors.ts    # DOM selectors
│   │   │   └── types.ts        # Zerodha-specific raw response types
│   │   └── indmoney/
│   │       ├── index.ts        # INDmoney adapter
│   │       ├── scraper.ts      # INDmoney page scraper + network interception
│   │       ├── endpoints.ts    # Known INDmoney internal API endpoints
│   │       ├── selectors.ts    # DOM selectors
│   │       └── types.ts        # INDmoney-specific raw response types
│   │
│   ├── browser/                # Shared Playwright infrastructure
│   │   ├── manager.ts          # Browser lifecycle (launch, persistent context, cleanup)
│   │   ├── auth-flow.ts        # Interactive login flow handler (visible browser for user)
│   │   ├── interceptor.ts      # Network request/response interception engine
│   │   ├── recorder.ts         # Records navigation patterns for learn_broker tool
│   │   └── helpers.ts          # Wait utilities, anti-detection, screenshot helpers
│   │
│   ├── auth/                   # Authentication & session management
│   │   ├── session-store.ts    # In-memory encrypted session store
│   │   └── crypto.ts           # AES-256-GCM encrypt/decrypt utilities
│   │
│   ├── normalizer/             # Data normalization layer
│   │   └── index.ts            # Transform broker-specific data → unified types
│   │
│   └── utils/
│       ├── logger.ts           # Logger (MUST write to stderr, never stdout)
│       ├── retry.ts            # Retry with exponential backoff
│       └── config.ts           # Environment config loader
│
├── browser-data/               # Persistent Chrome profile data (gitignored)
│   ├── groww/                  # Groww browser context data
│   ├── zerodha/                # Zerodha browser context data
│   └── indmoney/               # INDmoney browser context data
│
├── recordings/                 # Output from learn_broker_navigation (gitignored)
│
└── tests/
    ├── adapters/               # Unit tests per adapter
    ├── normalizer/             # Normalization tests
    └── fixtures/               # Sample intercepted API responses
```

---

## Core Strategy: Network Interception over DOM Scraping

All three brokers (Groww, Zerodha Kite, INDmoney) are **React/SPA-based web apps**. They fetch data from internal REST APIs via XHR/fetch, then render it in the UI. Our primary data extraction strategy is:

1. **Intercept network responses** — capture the JSON payloads from internal API calls. This gives us structured data directly, far more reliable than parsing the DOM.
2. **DOM scraping as fallback** — only when network interception misses something or for data that's rendered client-side.
3. **Page navigation to trigger data loads** — navigate to specific pages to force the SPA to make the API calls we want to intercept.

```typescript
// Core pattern used across all adapters
async function captureData(page: Page, targetUrl: string, apiPattern: string | RegExp): Promise<any> {
  const captured = new Promise((resolve) => {
    page.on('response', async (response) => {
      if (response.url().match(apiPattern) && response.status() === 200) {
        resolve(await response.json());
      }
    });
  });

  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  return await captured;
}
```

---

## MCP Tools to Implement

### Authentication Tools

| Tool | Description |
|---|---|
| `broker_connect` | Connect to a broker. Opens a visible Chrome browser to the broker's login page. User logs in manually (including OTP/2FA). Server captures session cookies/tokens once login is detected. Accepts: `broker` name and optionally `cookies` (if user wants to paste cookies directly via F12 → `document.cookie`). |
| `broker_disconnect` | Disconnect and securely wipe session for a broker. Clears browser context and in-memory session data. |
| `broker_status` | Show connection status for all brokers — which are connected, session age, and what features are available per broker. |

### Portfolio Tools (Read-Only)

| Tool | Description |
|---|---|
| `get_holdings` | Fetch stock holdings from one or all connected brokers. Returns unified format with symbol, quantity, avg price, current value, P&L. |
| `get_positions` | Fetch open positions (intraday/delivery/F&O) from one or all connected brokers. |
| `get_orders` | Fetch today's order history from one or all connected brokers. |
| `get_mutual_funds` | Fetch mutual fund holdings — scheme name, units, NAV, invested value, current value, returns, XIRR, SIP status. |
| `get_us_stocks` | Fetch US stock holdings (INDmoney, Groww). Symbol, quantity, avg price USD, current price, P&L in INR. |
| `get_gold` | Fetch gold/digital gold/SGB holdings (INDmoney, Groww). |
| `get_fno_positions` | Fetch F&O positions specifically (Groww, Zerodha). |
| `get_portfolio_summary` | Aggregated portfolio summary across all connected brokers — total invested, current value, total P&L, asset allocation breakdown (equity, MF, US stocks, gold, F&O), broker-wise split. |

### Market Data Tools

| Tool | Description |
|---|---|
| `search_stock` | Search for a stock/MF by name or symbol using the broker's own search (navigates to search page, types query, captures results). |
| `get_quote` | Get current price/quote for a stock by navigating to its detail page or intercepting quote API calls. |

### Development / Calibration Tool

| Tool | Description |
|---|---|
| `learn_broker_navigation` | **Key development tool.** Opens a visible Chrome browser to a specified broker URL. The user logs in and navigates to relevant pages (holdings, MF dashboard, etc.). While the user browses, the tool records: (1) every URL visited, (2) all XHR/fetch requests with full response bodies, (3) DOM accessibility tree snapshots per page, (4) screenshots. Saves recordings to `./recordings/{broker}/{timestamp}/`. This data is used to build and maintain the scraper endpoints and selectors. |

---

## MCP Resources to Implement

| Resource URI | Description |
|---|---|
| `broker://status` | Current connection status for all brokers |
| `broker://{name}/holdings` | Cached holdings for a specific broker |
| `broker://{name}/mutual-funds` | Cached MF holdings for a specific broker |
| `portfolio://summary` | Aggregated portfolio summary |

---

## Unified Data Types

Define in `src/types/portfolio.ts`:

```typescript
interface Holding {
  broker: string;           // "groww" | "zerodha" | "indmoney"
  symbol: string;           // Trading symbol (e.g., "RELIANCE")
  isin: string;             // ISIN code
  name: string;             // Full company name
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  exchange: string;         // "NSE" | "BSE"
  assetType: "EQUITY" | "ETF";
}

interface Position {
  broker: string;
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  product: string;          // "CNC" | "MIS" | "NRML"
  instrumentType: "EQ" | "FUT" | "CE" | "PE";
}

interface MutualFundHolding {
  broker: string;
  schemeName: string;
  amcName: string;
  folioNumber: string;
  units: number;
  nav: number;
  investedValue: number;
  currentValue: number;
  returns: number;
  returnsPercent: number;
  xirr?: number;
  sipActive: boolean;
  category: string;         // "Equity" | "Debt" | "Hybrid" | "Index" | etc.
}

interface USStockHolding {
  broker: string;
  symbol: string;           // US ticker (e.g., "AAPL")
  name: string;
  quantity: number;
  averagePriceUSD: number;
  currentPriceUSD: number;
  investedValueINR: number;
  currentValueINR: number;
  pnlINR: number;
}

interface GoldHolding {
  broker: string;
  type: "DIGITAL_GOLD" | "SOVEREIGN_GOLD_BOND" | "GOLD_ETF";
  quantityGrams?: number;
  units?: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
}

interface Order {
  broker: string;
  orderId: string;
  symbol: string;
  exchange: string;
  type: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT" | "SL" | "SLM";
  product: string;
  quantity: number;
  price: number;
  triggerPrice?: number;
  status: "OPEN" | "COMPLETE" | "CANCELLED" | "REJECTED";
  timestamp: string;
}

interface PortfolioSummary {
  totalInvestedValue: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  assetAllocation: {
    equity: number;
    mutualFunds: number;
    usStocks: number;
    gold: number;
    fno: number;
  };
  brokerWise: Array<{
    broker: string;
    investedValue: number;
    currentValue: number;
    pnl: number;
  }>;
}
```

---

## Broker Adapter Interface

```typescript
// src/types/broker.ts

interface BrokerAdapter {
  readonly name: string;      // "groww" | "zerodha" | "indmoney"
  readonly displayName: string;
  readonly loginUrl: string;
  readonly dashboardUrl: string;
  readonly supportedFeatures: {
    stocks: boolean;
    fno: boolean;
    mutualFunds: boolean;
    usStocks: boolean;
    gold: boolean;
  };

  // Auth
  connect(method: "browser_login" | "cookies", cookies?: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getSessionAge(): number;    // minutes since login

  // Portfolio data — each returns empty array if feature not supported
  getHoldings(): Promise<Holding[]>;
  getPositions(): Promise<Position[]>;
  getOrders(): Promise<Order[]>;
  getMutualFunds(): Promise<MutualFundHolding[]>;
  getUSStocks(): Promise<USStockHolding[]>;
  getGold(): Promise<GoldHolding[]>;
  getFnOPositions(): Promise<Position[]>;

  // Market data
  searchStock(query: string): Promise<SearchResult[]>;
  getQuote(symbol: string): Promise<Quote>;
}
```

---

## Broker-Specific Implementation Notes

### Groww (groww.in)

**Login**: `https://groww.in/login` — email/phone + password + OTP.

**Key pages and their internal API calls to intercept**:

| Data | Navigate To | Intercept Pattern |
|---|---|---|
| Stock Holdings | `https://groww.in/dashboard/investments` | XHR containing holdings array with `tradingsymbol`, `quantity`, `averagePrice` |
| F&O Positions | `https://groww.in/dashboard/investments` | XHR containing position data with segment info |
| Mutual Funds | `https://groww.in/mutual-funds/dashboard` | XHR returning MF portfolio with scheme names, NAV, returns |
| Orders | `https://groww.in/dashboard/orders` | XHR containing order list |
| US Stocks | `https://groww.in/us-stocks/portfolio` (if available) | Discover via `learn_broker_navigation` |
| Gold | `https://groww.in/gold/dashboard` (if available) | Discover via `learn_broker_navigation` |
| Stock search | Any page with search bar | XHR to search/entity endpoint |

**Login detection**: URL redirects to `/dashboard` or auth cookies/tokens appear.

**Notes**:
- Groww's SPA makes internal API calls with Bearer tokens in the `Authorization` header.
- Intercept the Authorization header value from any authenticated request to understand the auth pattern.
- Groww may use WebSocket for live price updates — not needed for portfolio data.
- Exact internal API paths need discovery via `learn_broker_navigation` since they are undocumented.

### Zerodha Kite (kite.zerodha.com)

**Login**: `https://kite.zerodha.com/` — user ID + password + TOTP/PIN.

**Key pages and their internal API calls to intercept**:

| Data | Navigate To | Intercept Pattern |
|---|---|---|
| Holdings | `https://kite.zerodha.com/holdings` | `kite.zerodha.com/oms/portfolio/holdings` |
| Positions | `https://kite.zerodha.com/positions` | `kite.zerodha.com/oms/portfolio/positions` |
| Orders | `https://kite.zerodha.com/orders` | `kite.zerodha.com/oms/orders` |
| Mutual Funds (Coin) | `https://coin.zerodha.com/dashboard` | Coin-specific API endpoints (discover via recorder) |
| Quote | Instrument page | `kite.zerodha.com/oms/quote` |

**Login detection**: `enctoken` cookie is set after successful login.

**Notes**:
- Kite's OMS endpoints are well-known and return clean JSON: `/oms/portfolio/holdings` gives `tradingsymbol`, `exchange`, `isin`, `quantity`, `average_price`, `last_price`, `pnl`.
- The `enctoken` cookie is used for all `/oms/*` API calls.
- Coin (mutual funds) is at `coin.zerodha.com` — may need separate context or cookie scope handling.
- Sessions last ~6-8 hours.

### INDmoney (indmoney.com)

**Login**: `https://www.indmoney.com/` — phone number + OTP only (no password).

**Key pages and their internal API calls to intercept**:

| Data | Navigate To | Intercept Pattern |
|---|---|---|
| Dashboard | `https://www.indmoney.com/dashboard` | Multiple XHR calls loading portfolio summary |
| Indian Stocks | `https://www.indmoney.com/indian-stocks/portfolio` | Internal API returning stock holdings |
| Mutual Funds | `https://www.indmoney.com/mutual-funds/portfolio` | Internal API returning MF portfolio |
| US Stocks | `https://www.indmoney.com/us-stocks/portfolio` | Internal API returning US stock holdings |
| Gold | `https://www.indmoney.com/gold` | Internal API returning gold holdings |

**Login detection**: URL changes to `/dashboard` and auth cookies/tokens are set.

**Notes**:
- Fully SPA-based (React). All data via internal APIs.
- OTP login = user MUST be present for authentication.
- INDmoney aggregates data from linked external accounts (CDSL/NSDL, CAS). May show holdings from other brokers too.
- Exact API endpoints are undocumented — discover via `learn_broker_navigation`.
- Sessions may be longer-lived (days/weeks) compared to trading brokers.

---

## Browser Automation Details

### Persistent Browser Contexts

Use Playwright's **persistent context** to maintain sessions across server restarts:

```typescript
import { chromium } from 'playwright';

const context = await chromium.launchPersistentContext(
  `./browser-data/${brokerName}`,
  {
    headless: false,               // headed for login
    channel: 'chrome',             // use user's installed Chrome
    args: [
      '--disable-blink-features=AutomationControlled',
    ],
    viewport: { width: 1280, height: 800 },
  }
);
```

**Why persistent contexts?**
- Cookies/localStorage survive server restarts — user logs in once per session expiry.
- Each broker is isolated in its own profile directory.

### Interactive Login Flow

When `broker_connect` is called with `browser_login`:

1. Launch Chromium **headed** (`headless: false`) with persistent context.
2. Navigate to broker's login URL.
3. **Inform user** (via MCP response) that browser is open and they should log in.
4. Monitor for login success:
   - **URL-based**: Navigation to dashboard.
   - **Cookie-based**: Session cookie appears (e.g., `enctoken` for Zerodha).
   - **Network-based**: First authenticated API response (200 on portfolio endpoint).
5. On success: capture cookies, localStorage keys, auth headers → store encrypted in memory.
6. Return success to MCP client.

### Cookie-Based Connect

User provides raw cookies from F12 → Console → `document.cookie`:

1. Parse and inject cookies into Playwright context.
2. Navigate to dashboard to validate.
3. If dashboard loads (no login redirect), session is valid.

### Network Interception Engine

```typescript
interface InterceptionResult {
  url: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
}

class NetworkInterceptor {
  private captures: Map<string, InterceptionResult[]> = new Map();

  addPattern(name: string, urlPattern: string | RegExp): void;
  async attach(page: Page): Promise<void>;
  async navigateAndCapture(page: Page, url: string, patternName: string, timeout?: number): Promise<InterceptionResult>;
  getCaptures(patternName: string): InterceptionResult[];
  clear(): void;
}
```

### Anti-Detection Measures

```typescript
args: [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
],

// Remove webdriver flag
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
});

// Use channel: 'chrome' for real Chrome instead of Chromium
// Add random delays (50-200ms) between actions
```

### `learn_broker_navigation` Recorder

```typescript
class BrowserRecorder {
  private recordings: Array<{
    timestamp: number;
    url: string;
    type: 'navigation' | 'xhr_request' | 'xhr_response' | 'dom_snapshot' | 'screenshot';
    data: any;
  }> = [];

  async startRecording(page: Page, broker: string): Promise<void> {
    page.on('framenavigated', (frame) => { /* capture URL */ });

    page.on('request', (req) => {
      if (['xhr', 'fetch'].includes(req.resourceType())) {
        // Record: url, method, headers, postData
      }
    });

    page.on('response', async (res) => {
      if (['xhr', 'fetch'].includes(res.request().resourceType())) {
        // Record: url, status, headers, JSON body
      }
    });
  }

  async snapshot(page: Page): Promise<void> {
    // Capture accessibility tree + full-page screenshot
  }

  async save(broker: string): Promise<string>;
}
```

---

## Security Requirements

1. **No credentials in plaintext** — session data encrypted with AES-256-GCM in memory. Persistent contexts on disk use Chromium's internal format.
2. **Session auto-expiry** — configurable TTL (default: 6 hours). After expiry, broker marked disconnected.
3. **Secure wipe on disconnect** — clears in-memory session AND deletes persistent browser context directory.
4. **No credential logging** — NEVER log cookies, tokens, passwords, OTPs.
5. **STDIO safety** — NEVER `console.log()`. All logging to `stderr`.
6. **Browser isolation** — each broker has its own persistent context directory.
7. **Read-only only** — NO order placement, modification, or fund transfer tools.

---

## Configuration

### `.env.example`

```env
# Encryption key for session store (32-byte hex, auto-generated if not set)
SESSION_ENCRYPTION_KEY=

# Session TTL in hours (default: 6)
SESSION_TTL_HOURS=6

# Browser settings
BROWSER_HEADLESS=false
BROWSER_SLOW_MO=100
BROWSER_DATA_DIR=./browser-data

# Log level: debug | info | warn | error
LOG_LEVEL=info

# Recordings output directory
RECORDINGS_DIR=./recordings
```

### `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "indian-broker": {
      "command": "node",
      "args": ["./build/index.js"],
      "cwd": "/path/to/indian-broker-mcp"
    }
  }
}
```

### Claude Code

```bash
claude mcp add indian-broker -- node /path/to/indian-broker-mcp/build/index.js
```

---

## Implementation Order

### Phase 1: Foundation
1. Project scaffolding (package.json, tsconfig.json, directory structure).
2. MCP server skeleton with STDIO transport.
3. Logger (stderr-only), config loader, retry utility.
4. Unified types (`portfolio.ts`, `broker.ts`, `auth.ts`).
5. Session store with AES-256-GCM encryption.
6. Register `broker_status` tool → verify MCP connectivity.

### Phase 2: Browser Infrastructure
1. Playwright browser manager with persistent contexts.
2. Interactive login flow handler.
3. Network interception engine.
4. `broker_connect` tool with `browser_login` method.
5. `learn_broker_navigation` tool + recorder.
6. Test: open a broker, login, verify session capture works.

### Phase 3: First Broker — Zerodha (easiest, well-known OMS endpoints)
1. Use `learn_broker_navigation` to confirm Kite OMS endpoint patterns.
2. Build Zerodha scraper using network interception on `/oms/*` routes.
3. Implement `getHoldings()`, `getPositions()`, `getOrders()`.
4. Build normalizer: Zerodha responses → unified types.
5. Wire up `get_holdings`, `get_positions`, `get_orders` MCP tools.
6. Handle Coin (MF) if accessible.

### Phase 4: Groww Adapter
1. Use `learn_broker_navigation` to discover Groww's internal API endpoints.
2. Build Groww scraper for: Holdings, Positions, MF, Orders.
3. Implement all portfolio methods + normalizer.
4. Discover and implement US Stocks, Gold if available on web app.

### Phase 5: INDmoney Adapter
1. Use `learn_broker_navigation` to discover all internal endpoints.
2. Build INDmoney scraper: Indian Stocks, MF, US Stocks, Gold.
3. Implement all portfolio methods + normalizer.

### Phase 6: Aggregation & Polish
1. `get_portfolio_summary` — cross-broker aggregation.
2. MCP Resources for cached data.
3. Market data tools (`search_stock`, `get_quote`).
4. Cookie-based connect method.
5. Error handling: session expiry detection, graceful degradation.
6. README.md.

---

## Critical Implementation Rules

### STDIO Transport — Never Write to stdout
```typescript
// ❌ NEVER — breaks MCP JSON-RPC
console.log("anything");

// ✅ ALWAYS
console.error("Server started");

// ✅ BETTER — custom logger
import { logger } from './utils/logger.js';
logger.info("Server started"); // writes to process.stderr
```

### MCP Server Setup Pattern
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "indian-broker-mcp",
  version: "1.0.0",
});

server.tool(
  "broker_connect",
  "Connect to an Indian broker by opening a browser for login",
  {
    broker: z.enum(["groww", "zerodha", "indmoney"]),
    method: z.enum(["browser_login", "cookies"]).default("browser_login"),
    cookies: z.string().optional().describe("Raw cookie string if method is 'cookies'"),
  },
  async ({ broker, method, cookies }) => {
    // Launch browser, handle login, capture session
    return {
      content: [{
        type: "text",
        text: `Browser opened for ${broker}. Please log in. Session will be captured automatically.`,
      }],
    };
  }
);

server.tool(
  "get_holdings",
  "Fetch stock holdings from connected brokers",
  {
    broker: z.enum(["groww", "zerodha", "indmoney", "all"]).default("all"),
  },
  async ({ broker }) => {
    return {
      content: [{ type: "text", text: JSON.stringify(holdings, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Package.json
```json
{
  "name": "indian-broker-mcp",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "indian-broker-mcp": "./build/index.js"
  },
  "scripts": {
    "build": "tsc && chmod 755 build/index.js",
    "dev": "tsc --watch",
    "start": "node build/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "^3.25.0",
    "playwright": "^1.48.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "tests"]
}
```

---

## Broker Feature Matrix

| Feature | Groww | Zerodha Kite | INDmoney |
|---|---|---|---|
| Stocks/Holdings | ✅ | ✅ | ✅ |
| F&O Positions | ✅ | ✅ | ❌ |
| Mutual Funds | ✅ | ✅ (Coin) | ✅ |
| US Stocks | ✅ | ❌ | ✅ |
| Gold | ✅ | ❌ | ✅ |
| Orders/Trades | ✅ | ✅ | ✅ |
| Login Method | Email/Phone + OTP | User ID + Password + TOTP | Phone + OTP |

All data access is via Playwright browser automation (network interception + DOM fallback).

---

## Error Handling

1. **Session expiry**: If page navigation redirects to login → mark disconnected, ask user to reconnect.
2. **Graceful degradation**: If one data source fails, return partial data with error details.
3. **Structured responses**:
   ```json
   { "success": true, "data": [...], "errors": [], "broker": "groww", "fetchedAt": "..." }
   ```
4. **Timeouts**: Page navigation 30s, network interception 15s, total tool execution 60s.
5. **Retry**: Up to 2 retries with exponential backoff.
6. **Anti-bot**: If CAPTCHA detected, inform user and suggest cookie-based auth.

---

## Testing

- **Unit tests**: Normalizers with fixture data (captured JSON responses).
- **MCP Inspector**: `npx @modelcontextprotocol/inspector` for interactive testing.
- **Mock mode**: `MOCK_MODE=true` returns fixture data without launching browsers.
- **Recording playback**: Use `learn_broker_navigation` recordings as test fixtures.

---

## Important Caveats

1. **Browser scraping is fragile** — broker UIs change frequently. `learn_broker_navigation` exists for recalibration.
2. **Strictly read-only** — NO order placement tools. Risk of accidental AI-triggered trades is too high.
3. **Session lifetimes vary** — Zerodha ~6-8h, Groww varies, INDmoney can be days.
4. **OTP logins need user presence** — INDmoney and Groww require manual OTP entry.
5. **ToS considerations** — scraping may violate broker terms. Personal use only.
6. **Rate limiting** — add delays between navigations, cache aggressively.
7. **`browser-data/` is sensitive** — gitignore it, `broker_disconnect` deletes it.