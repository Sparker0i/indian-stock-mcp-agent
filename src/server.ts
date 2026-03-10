import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "./utils/logger.js";
import { config } from "./utils/config.js";
import { initCrypto } from "./auth/crypto.js";
import { SessionStore } from "./auth/session-store.js";
import { BrowserManager } from "./browser/manager.js";
import { AuthFlow } from "./browser/auth-flow.js";
import { BrowserRecorder } from "./browser/recorder.js";
import type { BrokerAdapter, BrokerName } from "./types/broker.js";
import type { BrokerStatus } from "./types/auth.js";
import { buildPortfolioSummary } from "./normalizer/index.js";
import { GrowwAdapter } from "./adapters/groww/index.js";
import { ZerodhaAdapter } from "./adapters/zerodha/index.js";
import { IndmoneyAdapter } from "./adapters/indmoney/index.js";

const BROKER_NAMES: BrokerName[] = ["groww", "zerodha", "indmoney"];

const BROKER_META: Record<BrokerName, { displayName: string; features: BrokerStatus["features"] }> = {
  groww: {
    displayName: "Groww",
    features: { stocks: true, fno: true, mutualFunds: true, usStocks: true, gold: true },
  },
  zerodha: {
    displayName: "Zerodha Kite",
    features: { stocks: true, fno: true, mutualFunds: true, usStocks: false, gold: false },
  },
  indmoney: {
    displayName: "INDmoney",
    features: { stocks: true, fno: false, mutualFunds: true, usStocks: true, gold: true },
  },
};

function createAdapterInstance(broker: BrokerName): BrokerAdapter {
  switch (broker) {
    case "groww": return new GrowwAdapter();
    case "zerodha": return new ZerodhaAdapter();
    case "indmoney": return new IndmoneyAdapter();
  }
}

export function createServer(): {
  server: McpServer;
  sessionStore: SessionStore;
  browserManager: BrowserManager;
} {
  initCrypto(config.sessionEncryptionKey);

  const server = new McpServer({
    name: "indian-broker-mcp",
    version: "1.0.0",
  });

  const sessionStore = new SessionStore(config.sessionTtlHours);
  const browserManager = new BrowserManager(config);
  const adapters = new Map<BrokerName, BrokerAdapter>();
  const activeRecorders = new Map<BrokerName, BrowserRecorder>();

  // --- MCP Resources ---

  server.resource(
    "broker_status_resource",
    "broker://status",
    { description: "Current connection status for all brokers" },
    async () => {
      const statuses = getStatusList();
      return {
        contents: [{
          uri: "broker://status",
          text: JSON.stringify(statuses, null, 2),
          mimeType: "application/json",
        }],
      };
    },
  );

  server.resource(
    "broker_holdings",
    new ResourceTemplate("broker://{name}/holdings", { list: undefined }),
    { description: "Cached holdings for a specific broker" },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const brokerName = String(variables.name) as BrokerName;
      const adapter = adapters.get(brokerName);
      let data: unknown[] = [];
      let error: string | undefined;

      if (adapter && adapter.isConnected()) {
        try { data = await adapter.getHoldings(); } catch (e) { error = String(e); }
      } else {
        error = `${brokerName} is not connected`;
      }

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ broker: brokerName, data, error, fetchedAt: new Date().toISOString() }, null, 2),
          mimeType: "application/json",
        }],
      };
    },
  );

  server.resource(
    "broker_mutual_funds",
    new ResourceTemplate("broker://{name}/mutual-funds", { list: undefined }),
    { description: "Cached mutual fund holdings for a specific broker" },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const brokerName = String(variables.name) as BrokerName;
      const adapter = adapters.get(brokerName);
      let data: unknown[] = [];
      let error: string | undefined;

      if (adapter && adapter.isConnected()) {
        try { data = await adapter.getMutualFunds(); } catch (e) { error = String(e); }
      } else {
        error = `${brokerName} is not connected`;
      }

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ broker: brokerName, data, error, fetchedAt: new Date().toISOString() }, null, 2),
          mimeType: "application/json",
        }],
      };
    },
  );

  server.resource(
    "portfolio_summary_resource",
    "portfolio://summary",
    { description: "Aggregated portfolio summary across all connected brokers" },
    async () => {
      const connected = getConnectedBrokers();
      if (connected.length === 0) {
        return {
          contents: [{
            uri: "portfolio://summary",
            text: JSON.stringify({ error: "No brokers connected" }),
            mimeType: "application/json",
          }],
        };
      }

      const [holdings, positions, mutualFunds, usStocks, gold] = await Promise.all([
        safeGather(connected, (a) => a.getHoldings()),
        safeGather(connected, (a) => a.getPositions()),
        safeGather(connected, (a) => a.getMutualFunds()),
        safeGather(connected, (a) => a.getUSStocks()),
        safeGather(connected, (a) => a.getGold()),
      ]);

      const summary = buildPortfolioSummary(holdings, positions, mutualFunds, usStocks, gold);
      return {
        contents: [{
          uri: "portfolio://summary",
          text: JSON.stringify(summary, null, 2),
          mimeType: "application/json",
        }],
      };
    },
  );

  // --- Authentication Tools ---

  server.tool(
    "broker_status",
    "Show connection status for all brokers",
    {},
    async () => {
      const statuses = getStatusList();
      return {
        content: [{ type: "text", text: JSON.stringify(statuses, null, 2) }],
      };
    },
  );

  server.tool(
    "broker_connect",
    "Connect to an Indian broker by opening a browser for login",
    {
      broker: z.enum(["groww", "zerodha", "indmoney"]),
      method: z.enum(["browser_login", "cookies"]).default("browser_login"),
      cookies: z.string().optional().describe("Raw cookie string if method is 'cookies' (optional if set in .env)"),
    },
    async ({ broker, method, cookies }) => {
      const brokerName = broker as BrokerName;

      if (method === "cookies") {
        const cookieSource = cookies || config.brokerCookieEnv[brokerName];
        if (!cookieSource) {
          return {
            content: [{
              type: "text",
              text: `No cookies provided for ${BROKER_META[brokerName].displayName}. Pass cookies in tool input or set ${brokerName.toUpperCase()}_COOKIES in .env.`,
            }],
            isError: true,
          };
        }

        const context = await browserManager.getContext(brokerName, false);
        const page = await context.newPage();
        try {
          const authFlow = new AuthFlow(brokerName);
          await authFlow.connectWithCookies(page, cookieSource, sessionStore);
          initAdapter(brokerName, context);
          const adapter = adapters.get(brokerName);
          if (adapter) {
            await adapter.connect("cookies");
            logger.info(`Adapter connected for ${brokerName} via cookies`);
          }
          return {
            content: [{ type: "text", text: `Successfully connected to ${BROKER_META[brokerName].displayName} using cookies.` }],
          };
        } finally {
          await page.close();
        }
      }

      const context = await browserManager.getContext(brokerName, true);
      const page = await context.newPage();
      const authFlow = new AuthFlow(brokerName);

      try {
        await authFlow.startLogin(page, sessionStore);

        // Initialize adapter — it will be ready once the session is captured
        initAdapter(brokerName, context);

        // Monitor login completion in background to mark adapter connected
        monitorAdapterConnection(brokerName).catch((err) => {
          logger.error(`Adapter connection monitoring failed for ${brokerName}: ${err}`);
        });

        return {
          content: [{
            type: "text",
            text: `Browser opened for ${BROKER_META[brokerName].displayName}. Please log in manually (including OTP/2FA). Session will be captured automatically once login is detected. The browser window will remain open — do NOT close it.`,
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text",
            text: `Failed to open browser for ${BROKER_META[brokerName].displayName}: ${err instanceof Error ? err.message : String(err)}`,
          }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "broker_disconnect",
    "Disconnect from a broker and wipe session data",
    {
      broker: z.enum(["groww", "zerodha", "indmoney"]),
    },
    async ({ broker }) => {
      const brokerName = broker as BrokerName;

      // Save recording if active
      const recorder = activeRecorders.get(brokerName);
      let recordingPath: string | undefined;
      if (recorder) {
        try {
          recordingPath = await recorder.save();
          activeRecorders.delete(brokerName);
          logger.info(`Recording saved to ${recordingPath}`);
        } catch (err) {
          logger.error(`Failed to save recording: ${err}`);
        }
      }

      const adapter = adapters.get(brokerName);
      if (adapter) {
        await adapter.disconnect();
      }
      sessionStore.remove(brokerName);
      await browserManager.closeContext(brokerName);
      adapters.delete(brokerName);

      const msg = recordingPath
        ? `Disconnected from ${BROKER_META[brokerName].displayName}. Session data wiped.\n\nRecording saved to: ${recordingPath}`
        : `Disconnected from ${BROKER_META[brokerName].displayName}. Session data wiped.`;

      return {
        content: [{ type: "text", text: msg }],
      };
    },
  );

  // --- Portfolio Tools ---

  server.tool(
    "get_holdings",
    "Fetch stock holdings from connected brokers",
    { broker: z.enum(["groww", "zerodha", "indmoney", "all"]).default("all") },
    async ({ broker }) => {
      const result = await runPortfolioTool(broker, (a) => a.getHoldings());
      return result;
    },
  );

  server.tool(
    "get_positions",
    "Fetch open positions from connected brokers",
    { broker: z.enum(["groww", "zerodha", "indmoney", "all"]).default("all") },
    async ({ broker }) => runPortfolioTool(broker, (a) => a.getPositions()),
  );

  server.tool(
    "get_orders",
    "Fetch today's order history from connected brokers",
    { broker: z.enum(["groww", "zerodha", "indmoney", "all"]).default("all") },
    async ({ broker }) => runPortfolioTool(broker, (a) => a.getOrders()),
  );

  server.tool(
    "get_mutual_funds",
    "Fetch mutual fund holdings from connected brokers",
    { broker: z.enum(["groww", "zerodha", "indmoney", "all"]).default("all") },
    async ({ broker }) => runPortfolioTool(broker, (a) => a.getMutualFunds()),
  );

  server.tool(
    "get_us_stocks",
    "Fetch US stock holdings from connected brokers",
    { broker: z.enum(["groww", "zerodha", "indmoney", "all"]).default("all") },
    async ({ broker }) => runPortfolioTool(broker, (a) => a.getUSStocks()),
  );

  server.tool(
    "get_gold",
    "Fetch gold holdings from connected brokers",
    { broker: z.enum(["groww", "zerodha", "indmoney", "all"]).default("all") },
    async ({ broker }) => runPortfolioTool(broker, (a) => a.getGold()),
  );

  server.tool(
    "get_fno_positions",
    "Fetch F&O positions from connected brokers",
    { broker: z.enum(["groww", "zerodha", "indmoney", "all"]).default("all") },
    async ({ broker }) => runPortfolioTool(broker, (a) => a.getFnOPositions()),
  );

  server.tool(
    "get_portfolio_summary",
    "Aggregated portfolio summary across all connected brokers",
    {},
    async () => {
      const connected = getConnectedBrokers();
      if (connected.length === 0) {
        return { content: [{ type: "text", text: "No brokers connected. Use broker_connect first." }], isError: true };
      }

      const [holdings, positions, mutualFunds, usStocks, gold] = await Promise.all([
        gatherData(connected, (a) => a.getHoldings()),
        gatherData(connected, (a) => a.getPositions()),
        gatherData(connected, (a) => a.getMutualFunds()),
        gatherData(connected, (a) => a.getUSStocks()),
        gatherData(connected, (a) => a.getGold()),
      ]);

      const errors = [...holdings, ...positions, ...mutualFunds, ...usStocks, ...gold]
        .filter((r) => !r.success)
        .map((r) => `${r.broker}: ${r.error}`);

      const summary = buildPortfolioSummary(
        holdings.flatMap((r) => r.data),
        positions.flatMap((r) => r.data),
        mutualFunds.flatMap((r) => r.data),
        usStocks.flatMap((r) => r.data),
        gold.flatMap((r) => r.data),
      );

      const response = { ...summary, errors: errors.length > 0 ? errors : undefined };
      return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
    },
  );

  // --- Market Data Tools ---

  server.tool(
    "search_stock",
    "Search for a stock or mutual fund by name or symbol",
    {
      query: z.string().describe("Search query (stock name or symbol)"),
      broker: z.enum(["groww", "zerodha", "indmoney"]).optional(),
    },
    async ({ query, broker }) => {
      const target = broker ? [broker as BrokerName] : getConnectedBrokers();
      if (target.length === 0) {
        return { content: [{ type: "text", text: "No brokers connected. Use broker_connect first." }], isError: true };
      }

      const results = await gatherData(target.slice(0, 1), (a) => a.searchStock(query));
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    },
  );

  server.tool(
    "get_quote",
    "Get current price quote for a stock",
    {
      symbol: z.string().describe("Stock symbol (e.g., RELIANCE)"),
      broker: z.enum(["groww", "zerodha", "indmoney"]).optional(),
    },
    async ({ symbol, broker }) => {
      const target = broker ? [broker as BrokerName] : getConnectedBrokers();
      if (target.length === 0) {
        return { content: [{ type: "text", text: "No brokers connected. Use broker_connect first." }], isError: true };
      }

      const adapter = ensureAdapter(target[0]);
      if (!adapter) {
        return { content: [{ type: "text", text: `Broker ${target[0]} not connected.` }], isError: true };
      }

      try {
        const quote = await adapter.getQuote(symbol);
        return { content: [{ type: "text", text: JSON.stringify(quote, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error fetching quote: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // --- Development Tool ---

  server.tool(
    "learn_broker_navigation",
    "Open a browser to record navigation patterns, XHR requests, and DOM snapshots for a broker",
    {
      broker: z.enum(["groww", "zerodha", "indmoney"]),
      url: z.string().optional().describe("Starting URL (defaults to broker dashboard)"),
    },
    async ({ broker, url }) => {
      const brokerName = broker as BrokerName;

      try {
        const context = await browserManager.getContext(brokerName, true);
        const page = await context.newPage();
        const recorder = new BrowserRecorder();

        const startUrl = url || getBrokerDashboardUrl(brokerName);
        await recorder.startRecording(page, brokerName);
        await page.goto(startUrl, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {
          logger.warn(`Navigation to ${startUrl} did not fully complete, continuing recording`);
        });

        // Store the recorder so broker_disconnect can save it
        activeRecorders.set(brokerName, recorder);

        return {
          content: [{
            type: "text",
            text: `Recording started for ${BROKER_META[brokerName].displayName}.\n\nBrowser is open at: ${startUrl}\nNavigate to the pages you want to capture (holdings, MF dashboard, etc.).\n\nWhen done, use broker_disconnect to stop recording and save data to ${config.recordingsDir}/${brokerName}/.`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to start recording: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // --- Helper functions ---

  function getStatusList(): BrokerStatus[] {
    return BROKER_NAMES.map((name) => {
      const adapter = adapters.get(name);
      const sessionExists = sessionStore.has(name);
      const adapterConnected = adapter?.isConnected() ?? false;
      const connected = sessionExists && adapterConnected;

      // Session expiry detection: if session store says expired, disconnect adapter
      if (adapter && adapterConnected && !sessionExists) {
        logger.warn(`Session expired for ${name}, marking adapter disconnected`);
        adapter.disconnect().catch(() => {});
      }

      return {
        broker: name,
        displayName: BROKER_META[name].displayName,
        connected,
        sessionAgeMinutes: connected ? sessionStore.getSessionAge(name) : undefined,
        features: BROKER_META[name].features,
      };
    });
  }

  function getConnectedBrokers(): BrokerName[] {
    return BROKER_NAMES.filter((name) => {
      const adapter = adapters.get(name);
      return sessionStore.has(name) && adapter?.isConnected();
    });
  }

  function ensureAdapter(broker: BrokerName): BrokerAdapter | undefined {
    const adapter = adapters.get(broker);
    if (!adapter || !adapter.isConnected()) return undefined;

    // Check session expiry
    if (!sessionStore.has(broker)) {
      logger.warn(`Session expired for ${broker} during data fetch`);
      adapter.disconnect().catch(() => {});
      return undefined;
    }

    return adapter;
  }

  function initAdapter(brokerName: BrokerName, context: import("playwright").BrowserContext): void {
    const adapter = createAdapterInstance(brokerName);
    (adapter as GrowwAdapter | ZerodhaAdapter | IndmoneyAdapter).setContext(context);
    adapters.set(brokerName, adapter);
    logger.info(`Adapter initialized for ${brokerName}`);
  }

  async function monitorAdapterConnection(brokerName: BrokerName): Promise<void> {
    // Wait for session to be captured by the auth flow
    const timeout = 300000; // 5 min
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (sessionStore.has(brokerName)) {
        const adapter = adapters.get(brokerName);
        if (adapter) {
          await adapter.connect("browser_login");
          logger.info(`Adapter connected for ${brokerName}`);
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  function getBrokerDashboardUrl(broker: BrokerName): string {
    const urls: Record<BrokerName, string> = {
      groww: "https://groww.in/dashboard/investments",
      zerodha: "https://kite.zerodha.com/holdings",
      indmoney: "https://www.indmoney.com/dashboard",
    };
    return urls[broker];
  }

  interface GatherResult<T> {
    broker: string;
    success: boolean;
    data: T[];
    error?: string;
    fetchedAt: string;
  }

  async function gatherData<T>(
    brokers: BrokerName[],
    fetcher: (adapter: BrokerAdapter) => Promise<T[]>,
  ): Promise<GatherResult<T>[]> {
    return Promise.all(
      brokers.map(async (broker) => {
        const adapter = ensureAdapter(broker);
        if (!adapter) {
          return {
            broker,
            success: false,
            data: [] as T[],
            error: sessionStore.has(broker)
              ? `Adapter not ready for ${broker}. Try again shortly.`
              : `${broker} session expired. Please reconnect with broker_connect.`,
            fetchedAt: new Date().toISOString(),
          };
        }

        try {
          const data = await fetcher(adapter);
          return { broker, success: true, data, fetchedAt: new Date().toISOString() };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Detect login redirect as session expiry
          if (message.includes("login") || message.includes("redirect") || message.includes("unauthorized")) {
            logger.warn(`Session likely expired for ${broker}: ${message}`);
            sessionStore.remove(broker);
            adapter.disconnect().catch(() => {});
          }
          return { broker, success: false, data: [] as T[], error: message, fetchedAt: new Date().toISOString() };
        }
      }),
    );
  }

  /** Flatten gatherData results into a single array (for resources/summary) */
  async function safeGather<T>(
    brokers: BrokerName[],
    fetcher: (adapter: BrokerAdapter) => Promise<T[]>,
  ): Promise<T[]> {
    const results = await gatherData(brokers, fetcher);
    return results.flatMap((r) => r.data);
  }

  async function runPortfolioTool<T>(
    broker: string,
    fetcher: (adapter: BrokerAdapter) => Promise<T[]>,
  ): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    const brokers = broker === "all" ? getConnectedBrokers() : [broker as BrokerName];
    if (brokers.length === 0) {
      return { content: [{ type: "text", text: "No brokers connected. Use broker_connect first." }], isError: true };
    }
    const results = await gatherData(brokers, fetcher);
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  }

  return { server, sessionStore, browserManager };
}
