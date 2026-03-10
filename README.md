# Indian Broker MCP Server

A Model Context Protocol (MCP) server that connects to Indian broker platforms — **Groww**, **Zerodha Kite**, and **INDmoney** — to provide a unified, read-only view of your financial portfolio through Claude Code, Claude Desktop, or any MCP-compatible client.

No paid broker API subscriptions required. The server uses **Playwright browser automation** to capture data from the broker web apps after you log in via a visible Chrome window.

---

## Features

- **Unified portfolio view** across multiple brokers
- **Stocks, F&O, Mutual Funds, US Stocks, Gold** — all asset classes
- **Network interception** captures structured JSON from broker SPAs (more reliable than DOM scraping)
- **Persistent browser sessions** — log in once per session expiry
- **Encrypted session storage** (AES-256-GCM) in memory
- **Read-only** — no order placement, no fund transfers
- **Graceful degradation** — partial data returned if one broker fails

### Broker Support Matrix

| Feature | Groww | Zerodha Kite | INDmoney |
|---|:---:|:---:|:---:|
| Stock Holdings | Yes | Yes | Yes |
| F&O Positions | Yes | Yes | — |
| Mutual Funds | Yes | Yes (Coin) | Yes |
| US Stocks | Yes | — | Yes |
| Gold / SGB | Yes | — | Yes |
| Orders | Yes | Yes | Yes |
| Login Method | Email + OTP | User ID + Password + TOTP | Phone + OTP |

---

## Prerequisites

- **Node.js** 18+
- **Google Chrome** installed (Playwright uses your system Chrome via `channel: 'chrome'`)
- **Claude Code** or **Claude Desktop** (or any MCP client)

---

## Installation

```bash
git clone <repo-url> indian-broker-mcp
cd indian-broker-mcp
npm install
npx playwright install chromium
npm run build
```

## Configuration

Copy the example env file and edit as needed:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SESSION_ENCRYPTION_KEY` | Auto-generated | 32-byte hex key for AES-256-GCM session encryption |
| `SESSION_TTL_HOURS` | `6` | Session expiry time in hours |
| `BROWSER_HEADLESS` | `false` | Set `true` to run browsers headless (login still needs headed mode) |
| `BROWSER_SLOW_MO` | `100` | Delay in ms between Playwright actions (helps avoid detection) |
| `BROWSER_DATA_DIR` | `./browser-data` | Persistent browser profile storage |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `RECORDINGS_DIR` | `./recordings` | Output directory for `learn_broker_navigation` |

---

## Connecting to an MCP Client

### Claude Code

```bash
claude mcp add indian-broker -- node /path/to/indian-broker-mcp/build/index.js
```

### Claude Desktop

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json` on Linux, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "indian-broker": {
      "command": "node",
      "args": ["/path/to/indian-broker-mcp/build/index.js"]
    }
  }
}
```

Restart Claude Desktop after adding the configuration.

### MCP Inspector (for testing)

```bash
npx @modelcontextprotocol/inspector node ./build/index.js
```

Opens a web UI at `http://localhost:5173` where you can call tools interactively.

---

## Usage

### Step 1: Connect to a broker

Ask Claude:

> "Connect me to Zerodha"

This calls the `broker_connect` tool, which:
1. Opens a visible Chrome window to the broker's login page
2. You log in manually (including OTP / 2FA)
3. The server detects login success automatically and captures the session

You can also connect using cookies from your browser's DevTools:

> "Connect to Groww using these cookies: `<paste from document.cookie>`"

You can also preload cookies in `.env` and connect without passing cookies in chat:

```bash
INDMONEY_COOKIES="token=...; trace_id=...; user_id=...; user_session_id=...; device_id=...; __cf_bm=...; refresh_token=..."
```

Then call `broker_connect` with `method: "cookies"` and `broker: "indmoney"`.

### Step 2: Query your portfolio

Once connected, ask naturally:

- "What are my stock holdings?"
- "Show my mutual fund portfolio across all brokers"
- "What's my total portfolio value?"
- "Show my F&O positions on Zerodha"
- "What US stocks do I hold?"
- "Show today's orders"
- "Search for Reliance stock"

### Step 3: Disconnect

> "Disconnect from Zerodha"

This wipes the session data and deletes the browser profile for that broker.

---

## Tools Reference

### Authentication

| Tool | Parameters | Description |
|---|---|---|
| `broker_connect` | `broker` (groww/zerodha/indmoney), `method` (browser_login/cookies), `cookies?` | Connect to a broker. For `method=cookies`, uses `cookies` input or falls back to `{BROKER}_COOKIES` from `.env` |
| `broker_disconnect` | `broker` | Disconnect and wipe session |
| `broker_status` | — | Show connection status for all brokers |

### Portfolio (Read-Only)

| Tool | Parameters | Description |
|---|---|---|
| `get_holdings` | `broker` (default: all) | Stock holdings |
| `get_positions` | `broker` (default: all) | Open positions (intraday/delivery) |
| `get_fno_positions` | `broker` (default: all) | F&O positions specifically |
| `get_mutual_funds` | `broker` (default: all) | Mutual fund portfolio |
| `get_us_stocks` | `broker` (default: all) | US stock holdings |
| `get_gold` | `broker` (default: all) | Gold / SGB / Gold ETF holdings |
| `get_orders` | `broker` (default: all) | Today's order history |
| `get_portfolio_summary` | — | Aggregated summary across all brokers |

### Market Data

| Tool | Parameters | Description |
|---|---|---|
| `search_stock` | `query`, `broker?` | Search for stocks/MFs by name or symbol |
| `get_quote` | `symbol`, `broker?` | Current price quote for a stock |

### Development

| Tool | Parameters | Description |
|---|---|---|
| `learn_broker_navigation` | `broker`, `url?` | Record browser navigation, XHR requests, and DOM snapshots for building/updating scrapers |

---

## Resources

MCP Resources provide cached data accessible by URI:

| URI | Description |
|---|---|
| `broker://status` | Connection status for all brokers |
| `broker://{name}/holdings` | Holdings for a specific broker (e.g., `broker://zerodha/holdings`) |
| `broker://{name}/mutual-funds` | Mutual funds for a specific broker |
| `portfolio://summary` | Aggregated portfolio summary |

---

## Architecture

```
MCP Client (Claude Code / Desktop)
        │
        │ STDIO (JSON-RPC)
        ▼
┌─────────────────────────────────┐
│       MCP Server (Node.js)      │
│                                 │
│  ┌─────────┐ ┌───────┐ ┌─────┐ │
│  │  Groww   │ │Zerodha│ │ IND │ │
│  │ Adapter  │ │Adapter│ │money│ │
│  └────┬─────┘ └───┬───┘ └──┬──┘ │
│       │           │        │    │
│  ┌────▼───────────▼────────▼──┐ │
│  │   Playwright (Chrome)      │ │
│  │   • Network interception   │ │
│  │   • Page navigation        │ │
│  │   • Persistent contexts    │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌────────────────────────────┐ │
│  │  Session Store (encrypted) │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

### How data extraction works

1. **Navigate** to the relevant broker page (e.g., holdings dashboard)
2. **Intercept** the XHR/fetch responses the SPA makes to its internal APIs
3. **Parse** the structured JSON from those responses
4. **Normalize** broker-specific fields into unified types
5. **Return** to the MCP client in a consistent format

Network interception is the primary strategy because it captures clean, structured data directly from the broker's internal APIs — far more reliable than parsing the DOM.

---

## Project Structure

```
src/
├── index.ts                    # Entry point (STDIO transport)
├── server.ts                   # MCP server, tool/resource registration
├── types/
│   ├── portfolio.ts            # Holding, Position, MutualFundHolding, etc.
│   ├── broker.ts               # BrokerAdapter interface
│   └── auth.ts                 # Session types
├── adapters/
│   ├── base.ts                 # Abstract base adapter
│   ├── groww/
│   │   ├── index.ts            # Adapter + normalizers
│   │   ├── scraper.ts          # Network interception logic
│   │   ├── endpoints.ts        # URL patterns
│   │   ├── selectors.ts        # DOM selectors (fallback)
│   │   └── types.ts            # Raw API response types
│   ├── zerodha/                # Same structure
│   └── indmoney/               # Same structure
├── browser/
│   ├── manager.ts              # Browser lifecycle, persistent contexts
│   ├── auth-flow.ts            # Login detection + session capture
│   ├── interceptor.ts          # XHR/fetch response capture engine
│   ├── recorder.ts             # Navigation recorder for development
│   └── helpers.ts              # Utilities (delays, screenshots)
├── auth/
│   ├── crypto.ts               # AES-256-GCM encrypt/decrypt
│   └── session-store.ts        # In-memory encrypted session store
├── normalizer/
│   └── index.ts                # Portfolio summary aggregation
└── utils/
    ├── logger.ts               # stderr-only logger
    ├── config.ts               # .env config loader
    └── retry.ts                # Exponential backoff retry
```

---

## Session Management

- Sessions are stored **encrypted in memory** using AES-256-GCM
- Browser profiles are persisted to disk under `browser-data/{broker}/` so cookies survive server restarts
- Sessions auto-expire after the configured TTL (default: 6 hours)
- When a session expires, the next data request will return an error prompting you to reconnect
- `broker_disconnect` securely wipes both the in-memory session and the on-disk browser profile
- Each broker is fully isolated in its own browser context

### Typical session lifetimes

| Broker | Approximate Session Duration |
|---|---|
| Zerodha Kite | 6–8 hours |
| Groww | Varies |
| INDmoney | Days to weeks |

---

## Development

### Adding or updating broker scrapers

The `learn_broker_navigation` tool helps you discover and update internal API endpoints:

1. Call the tool: `learn_broker_navigation` with `broker: "groww"`
2. A Chrome window opens — log in and navigate to the pages you care about
3. The recorder captures every URL, XHR request/response, and DOM state
4. Recordings are saved to `recordings/{broker}/{timestamp}/`
5. Use the captured data to update `endpoints.ts` and `types.ts` for that broker

### Watch mode

```bash
npm run dev    # tsc --watch
```

### Key design decisions

- **Network interception over DOM scraping**: Broker SPAs fetch data via internal REST APIs. Intercepting those JSON responses is more reliable and structured than parsing rendered HTML.
- **Persistent browser contexts**: Using Playwright's `launchPersistentContext` so cookies/localStorage survive restarts. The user only needs to log in when the session expires.
- **Anti-detection**: Uses real Chrome (not Chromium), removes `webdriver` flag, adds random delays between actions.
- **Flexible response parsing**: Each adapter's normalizer handles multiple possible response shapes (brokers may change their API structure). Fields are accessed with fallback chains (`raw.field1 ?? raw.field2 ?? default`).

---

## Security

- **No credentials stored** — you log in manually; only session cookies are captured
- **AES-256-GCM encryption** for all in-memory session data
- **Cookies and tokens are never logged** — the logger redacts sensitive data
- **All output goes to stderr** — stdout is reserved for MCP JSON-RPC (writing to stdout would break the protocol)
- **Browser profiles are gitignored** and deleted on disconnect
- **Strictly read-only** — there are no tools for placing orders, modifying positions, or transferring funds

---

## Limitations

- **Browser scraping is fragile** — broker UIs and internal APIs change without notice. Use `learn_broker_navigation` to recalibrate when something breaks.
- **OTP login requires user presence** — Groww and INDmoney require manual OTP entry. Zerodha requires TOTP/PIN.
- **No real-time streaming** — data is fetched on demand by navigating to pages. There is no WebSocket or live price feed.
- **Rate limiting** — avoid calling portfolio tools in rapid succession. The server adds delays between page navigations but aggressive use may trigger broker anti-bot measures.
- **Terms of Service** — automated access to broker web apps may violate their terms. This tool is intended for personal use only.
- **Single user** — the server manages one session per broker. It is not designed for multi-user or shared access.

---

## License

MIT
