// Google ログイン（OpenID Connect の認可コードフロー）
const AUTH_URL = process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const ISSUERS = (process.env.GOOGLE_ISSUERS || "https://accounts.google.com,accounts.google.com").split(",");

export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_BASE_URL);
export const redirectUri = () => `${process.env.APP_BASE_URL.replace(/\/$/, "")}/api/auth/google/callback`;

export function authUrl(state, nonce) {
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: "code",
    scope: "openid email profile", state, nonce, prompt: "select_account"
  }).toString();
  return u.toString();
}

/** 認可コードを Google のトークン窓口と直接（TLS）交換し、ID トークンの中身を検証して返す */
export async function exchangeCode(code, nonce) {
  const res = await fetch(TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(), grant_type: "authorization_code" })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.id_token) throw new Error("token_exchange_failed");
  const part = j.id_token.split(".")[1] || "";
  const claims = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  if (!ISSUERS.includes(claims.iss)) throw new Error("bad_issuer");
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("bad_audience");
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("expired");
  if (claims.nonce !== nonce) throw new Error("bad_nonce");
  if (!claims.email || claims.email_verified !== true && claims.email_verified !== "true") throw new Error("email_not_verified");
  return { email: String(claims.email).toLowerCase(), name: claims.name || "", hd: claims.hd || "" };
}
