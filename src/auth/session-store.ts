import type { BrokerName } from "../types/broker.js";
import type { SessionData, EncryptedPayload } from "../types/auth.js";
import { encrypt, decrypt } from "./crypto.js";
import { logger } from "../utils/logger.js";

export class SessionStore {
  private sessions: Map<BrokerName, EncryptedPayload> = new Map();
  private ttlHours: number;

  constructor(ttlHours: number = 6) {
    this.ttlHours = ttlHours;
  }

  store(session: SessionData): void {
    const plaintext = JSON.stringify(session);
    const encrypted = encrypt(plaintext);
    this.sessions.set(session.broker, encrypted);
    logger.info(`Session stored for ${session.broker}`);
  }

  retrieve(broker: BrokerName): SessionData | null {
    const encrypted = this.sessions.get(broker);
    if (!encrypted) return null;

    try {
      const plaintext = decrypt(encrypted);
      const session: SessionData = JSON.parse(plaintext);

      if (Date.now() > session.expiresAt) {
        logger.warn(`Session expired for ${broker}`);
        this.sessions.delete(broker);
        return null;
      }

      return session;
    } catch (err) {
      logger.error(`Failed to decrypt session for ${broker}: ${err}`);
      this.sessions.delete(broker);
      return null;
    }
  }

  remove(broker: BrokerName): void {
    this.sessions.delete(broker);
    logger.info(`Session removed for ${broker}`);
  }

  has(broker: BrokerName): boolean {
    const session = this.retrieve(broker);
    return session !== null;
  }

  getSessionAge(broker: BrokerName): number {
    const session = this.retrieve(broker);
    if (!session) return -1;
    return Math.floor((Date.now() - session.connectedAt) / 60000);
  }

  getTtlHours(): number {
    return this.ttlHours;
  }

  clear(): void {
    this.sessions.clear();
    logger.info("All sessions cleared");
  }
}
