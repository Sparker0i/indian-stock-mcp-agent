import type { BrokerName } from "./broker.js";

export interface SessionData {
  broker: BrokerName;
  cookies: string;
  localStorage?: Record<string, string>;
  authHeaders?: Record<string, string>;
  connectedAt: number;
  expiresAt: number;
}

export interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface BrokerStatus {
  broker: BrokerName;
  displayName: string;
  connected: boolean;
  sessionAgeMinutes?: number;
  features: {
    stocks: boolean;
    fno: boolean;
    mutualFunds: boolean;
    usStocks: boolean;
    gold: boolean;
  };
}
