import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let encryptionKey: Buffer;

export function initCrypto(keyHex?: string): void {
  if (keyHex && keyHex.length === 64) {
    encryptionKey = Buffer.from(keyHex, "hex");
  } else {
    encryptionKey = crypto.randomBytes(32);
  }
}

export function encrypt(plaintext: string): { iv: string; tag: string; ciphertext: string } {
  if (!encryptionKey) {
    initCrypto();
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext,
  };
}

export function decrypt(encrypted: { iv: string; tag: string; ciphertext: string }): string {
  if (!encryptionKey) {
    throw new Error("Crypto not initialized");
  }

  const iv = Buffer.from(encrypted.iv, "hex");
  const tag = Buffer.from(encrypted.tag, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(encrypted.ciphertext, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}
