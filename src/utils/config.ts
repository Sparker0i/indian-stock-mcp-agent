import dotenv from "dotenv";
import path from "path";

dotenv.config();

export interface Config {
  sessionEncryptionKey: string | undefined;
  sessionTtlHours: number;
  browserHeadless: boolean;
  browserSlowMo: number;
  browserDataDir: string;
  logLevel: string;
  recordingsDir: string;
  brokerCookieEnv: Partial<Record<"groww" | "zerodha" | "indmoney", string>>;
}

export function loadConfig(): Config {
  return {
    sessionEncryptionKey: process.env.SESSION_ENCRYPTION_KEY || undefined,
    sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS || "6", 10),
    browserHeadless: process.env.BROWSER_HEADLESS === "true",
    browserSlowMo: parseInt(process.env.BROWSER_SLOW_MO || "100", 10),
    browserDataDir: path.resolve(process.env.BROWSER_DATA_DIR || "./browser-data"),
    logLevel: process.env.LOG_LEVEL || "info",
    recordingsDir: path.resolve(process.env.RECORDINGS_DIR || "./recordings"),
    brokerCookieEnv: {
      groww: process.env.GROWW_COOKIES || undefined,
      zerodha: process.env.ZERODHA_COOKIES || undefined,
      indmoney: process.env.INDMONEY_COOKIES || undefined,
    },
  };
}

export const config = loadConfig();
