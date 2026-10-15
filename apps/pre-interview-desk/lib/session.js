// 署名付きセッションCookie（HMAC-SHA256）。middleware（Edge）とAPI（Node）の両方で使えるよう WebCrypto だけで書く
const enc = new TextEncoder();
export const COOKIE = "desk_session";
export const SESSION_HOURS = 12;

const toB64u = buf => {
  let s = ""; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = str => {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};
async function key() {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET は32文字以上にしてください");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function signSession(payload) {
  const body = toB64u(enc.encode(JSON.stringify({ ...payload, exp: Date.now() + SESSION_HOURS * 3600e3 })));
  const sig = toB64u(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return `${body}.${sig}`;
}
export async function readSession(token) {
  try {
    if (!token) return null;
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64u(sig), enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64u(body)));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
