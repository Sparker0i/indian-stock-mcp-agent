# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An MCP server (TypeScript, STDIO transport) that connects to Indian brokers — Groww, Zerodha Kite, INDmoney — via Playwright browser automation. No paid broker APIs. User logs in via a visible Chrome window; the server captures cookies + intercepts the SPA's XHR/fetch responses to extract structured portfolio data.

Tooling overview: `README.md`. This file documents the things you cannot infer from `README.md` or the source.

## Commands

```bash
npm install                       # one-time
npx playwright install chromium   # one-time (Playwright browsers)
npm run build                     # tsc → ./build, chmods build/index.js
npm run dev                       # tsc --watch
npm start                         # node build/index.js (run after build)
npx @modelcontextprotocol/inspector node ./build/index.js   # interactive MCP testing
```

No test runner, no linter, no formatter is configured. Type errors from `tsc` are the only static check.

## Hard rules

1. **Never write to stdout.** STDIO is the MCP JSON-RPC channel — `console.log()` corrupts it and the client disconnects. Use `logger` from `src/utils/logger.ts` (writes to stderr). This includes `console.warn`, which on Node also goes to stderr but should still go through the logger for level filtering.
2. **Read-only only.** No order placement, modification, or fund-transfer tools — ever. This is a deliberate safety boundary; AI-triggered trades are out of scope.
3. **Never log cookies/tokens/OTPs.** The logger does not redact automatically — be explicit at call sites.

## Architecture

The data path for any portfolio query:

```
MCP tool handler (server.ts)
  → BrokerAdapter (adapters/<broker>/index.ts)
    → Scraper (adapters/<broker>/scraper.ts)
      → NetworkInterceptor (browser/interceptor.ts) attached to a Playwright Page
        → page.goto(targetUrl) triggers the SPA's internal API calls
        → response handler captures matching JSON body
    → normalize<Type>() converts raw broker JSON → unified types in types/portfolio.ts
```

### Three things that aren't obvious from the file tree

**1. Network interception is the primary data source, not DOM scraping.**
Every broker is a React SPA. We register URL patterns (`addPattern`), attach a `response` listener to the Page, then navigate. The SPA's XHR/fetch responses get captured as parsed JSON. DOM selectors in `adapters/*/selectors.ts` exist as fallbacks but are rarely used. See `adapters/zerodha/scraper.ts` for the canonical pattern: `clearPattern → navigateAndCapture → unwrap KiteApiResponse`. The Zerodha `/oms/*` routes are well-known; Groww and INDmoney endpoint patterns were discovered via the recorder and may need recalibration.

**2. `broker_connect` is asynchronous, two-stage.**
`broker_connect` returns immediately after opening the browser. Two background tasks then race the user's login:
- `AuthFlow.monitorLogin` (`browser/auth-flow.ts`) polls the page URL and cookies every 2s for up to 5 minutes. When it detects the dashboard URL pattern or the broker's session cookie (e.g., Zerodha's `enctoken`), it captures all cookies into `SessionStore`.
- `server.ts:monitorAdapterConnection` polls `sessionStore.has(broker)` every 2s. Once the session lands, it calls `adapter.connect()` which flips `BaseAdapter.connected = true`.

Until both stages finish, `gatherData` returns `"Adapter not ready for X. Try again shortly."` — this is not a bug; it means the user hasn't completed login yet.

**3. Per-broker browser context isolation.**
`BrowserManager.getContext` uses `chromium.launchPersistentContext(./browser-data/<broker>)` so each broker has its own cookies/localStorage and survives server restarts. `broker_disconnect` calls `closeContext`, which closes the context AND `rm -rf`s the on-disk profile directory. Don't `close()` shared browser instances; there aren't any — every broker is its own persistent context.

### Session model

- `SessionStore` (in-memory only): cookies encrypted with AES-256-GCM (`auth/crypto.ts`), TTL from `SESSION_TTL_HOURS` (default 6h).
- Browser data on disk (`./browser-data/<broker>/`): plaintext Chromium profile — gitignored, deleted on `broker_disconnect`.
- These two stores are checked together in `getStatusList`/`ensureAdapter`. If the in-memory session has expired but the adapter still thinks it's connected, the adapter is force-disconnected on the next status/data call. Login-redirect errors during `gatherData` also evict the session.

## Adding or fixing a broker

When a scraper breaks (broker changed their internal API path or response shape), the workflow is:

1. Call the `learn_broker_navigation` MCP tool with the broker name. This opens a headed Chrome and starts `BrowserRecorder` (`browser/recorder.ts`).
2. Log in and click through the affected pages. Every XHR/fetch request + response body, every navigation, and DOM snapshots are recorded.
3. Call `broker_disconnect` — this saves the recording to `./recordings/<broker>/<timestamp>/`.
4. Inspect the recorded responses to update:
   - `adapters/<broker>/endpoints.ts` — URL patterns and target navigation URLs
   - `adapters/<broker>/types.ts` — raw response shape (`Kite*`, `Groww*`, etc.)
   - `adapters/<broker>/index.ts` — the `normalize*` methods that map raw → unified types

Normalizers should use fallback chains (`raw.field1 ?? raw.field2 ?? default`) because brokers reshape responses without notice.

## Anti-detection

`BrowserManager` does the bare minimum: `channel: 'chrome'` (real Chrome, not bundled Chromium), `--disable-blink-features=AutomationControlled`, and an init script that hides `navigator.webdriver`. `slowMo` is only applied in headed (login) mode. Don't add fingerprinting evasion beyond this — these brokers are not aggressive about bot detection, and overcomplicating it tends to break logins.

## Things that look like bugs but aren't

- `BaseAdapter.connect()` ignores its arguments — adapters are stateless about *how* they connected; `SessionStore` owns that.
- `searchStock` in `server.ts` slices to `target.slice(0, 1)` — search is intentionally single-broker (querying every connected broker for the same string is wasteful and the results are not unified across brokers).
- `getQuote` falls back to `Object.values(body.data)[0]` if the exact `EXCHANGE:SYMBOL` key isn't found — Kite occasionally returns the quote under a different exchange key than requested.

## Environment

`.env` is loaded by `dotenv` in `src/utils/config.ts`. See `.env.example` for keys. `SESSION_ENCRYPTION_KEY` auto-generates on first run if empty; persisting it across restarts keeps existing in-memory sessions decryptable (though sessions are in-memory only, so this rarely matters).

Logs go to stderr at `LOG_LEVEL` (default `info`). MCP clients typically show stderr in their server logs panel.
