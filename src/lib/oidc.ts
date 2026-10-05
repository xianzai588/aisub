import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  OPENAI_CLIENT_ID,
  OPENAI_CLIENT_SECRET,
  OPENAI_REDIRECT_URI,
} from "./env";

// 端点来源：https://developers.openai.com/siwc/website（2026-10 核实）
// 生产建议启动时从 discovery 拉取并校验 issuer：
//   https://auth.openai.com/.well-known/openid-configuration
export const OIDC = {
  issuer: "https://auth.openai.com",
  authorizationEndpoint: "https://auth.openai.com/api/accounts/authorize",
  tokenEndpoint: "https://auth.openai.com/api/accounts/oauth/token",
  jwksUri: "https://auth.openai.com/.well-known/jwks.json",
  scope: "openid profile email",
} as const;

const b64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export interface OAuthTx {
  state: string;
  codeVerifier: string;
  nonce: string;
  ref?: string;
  expiresAt: number;
}

// 事务仅存服务端内存（重启即失效，10 分钟过期）。
// 生产请放 Redis/DB，并把 verifier 与浏览器会话绑定。
const txStore = new Map<string, OAuthTx>();
const TX_TTL_MS = 10 * 60 * 1000;

export function createTx(ref?: string): { id: string; tx: OAuthTx } {
  const tx: OAuthTx = {
    state: b64url(randomBytes(32)),
    codeVerifier: b64url(randomBytes(64)),
    nonce: b64url(randomBytes(16)),
    ref: ref || undefined,
    expiresAt: Date.now() + TX_TTL_MS,
  };
  const id = b64url(randomBytes(16));
  // 顺手清理过期事务
  for (const [k, v] of txStore) if (v.expiresAt < Date.now()) txStore.delete(k);
  txStore.set(id, tx);
  return { id, tx };
}

export function takeTx(id: string | undefined): OAuthTx | undefined {
  if (!id) return undefined;
  const tx = txStore.get(id);
  txStore.delete(id); // 一次性：取走即删
  if (!tx || tx.expiresAt < Date.now()) return undefined;
  return tx;
}

export function buildAuthorizeUrl(tx: OAuthTx): string {
  const url = new URL(OIDC.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", OPENAI_CLIENT_ID);
  url.searchParams.set("redirect_uri", OPENAI_REDIRECT_URI);
  url.searchParams.set("scope", OIDC.scope);
  url.searchParams.set("state", tx.state);
  url.searchParams.set("nonce", tx.nonce);
  url.searchParams.set("code_challenge", b64url(createHash("sha256").update(tx.codeVerifier).digest()));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface TokenResponse {
  id_token: string;
  access_token?: string;
  refresh_token?: string;
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: OPENAI_REDIRECT_URI,
    code_verifier: codeVerifier,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  // 文档要求：confidential client 的 secret 只能放 HTTP Basic 头，不能进表单
  if (OPENAI_CLIENT_SECRET) {
    const basic = Buffer.from(
      `${encodeURIComponent(OPENAI_CLIENT_ID)}:${encodeURIComponent(OPENAI_CLIENT_SECRET)}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${basic}`;
  } else {
    body.set("client_id", OPENAI_CLIENT_ID); // public client（纯 PKCE）
  }

  const res = await fetch(OIDC.tokenEndpoint, { method: "POST", headers, body });
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

const JWKS = createRemoteJWKSet(new URL(OIDC.jwksUri));

export async function verifyIdToken(idToken: string, expectedNonce: string) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: OIDC.issuer,
    audience: OPENAI_CLIENT_ID,
    clockTolerance: 5,
  });
  if (!payload.nonce || payload.nonce !== expectedNonce) {
    throw new Error("nonce mismatch");
  }
  return payload;
}
