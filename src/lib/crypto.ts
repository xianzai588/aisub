import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { SESSION_SECRET } from "./env";

// 客户提交的账号凭证静态加密（AES-256-GCM）。
// 生产请单独设置 CREDENTIAL_SECRET（openssl rand -base64 32），
// 未设置时从 SESSION_SECRET 派生并给出可辨识的回退。
const keyMaterial = process.env.CREDENTIAL_SECRET || `${SESSION_SECRET}|order-credentials`;
const KEY = createHash("sha256").update(keyMaterial).digest();

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptText(enc: string): string {
  const buf = Buffer.from(enc, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
