export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { cookies } from "next/headers";
import { desk } from "../../../lib/db.js";
import { verifyPassword } from "../../../lib/password.js";
import { COOKIE, SESSION_HOURS, signSession } from "../../../lib/session.js";
import { json } from "../../../lib/api.js";

export async function POST(req) {
  let b = {}; try { b = await req.json(); } catch {}
  const email = String(b.email || "").trim().toLowerCase(), password = String(b.password || "");
  if (!email || !password) return json({ error: "メールアドレスとパスワードを入れてください" }, 400);
  try {
    const [m] = await desk("select id::text, name, role, password_hash, active from desk_members where lower(email) = $1", [email]);
    const ok = m && m.active && await verifyPassword(password, m.password_hash);
    if (!ok) { await new Promise(r => setTimeout(r, 400)); return json({ error: "メールアドレスかパスワードが違います" }, 401); }
    await desk("update desk_members set last_login_at = now() where id = $1::uuid", [m.id]);
    cookies().set(COOKIE, await signSession({ uid: m.id }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600 });
    return json({ ok: true, name: m.name, role: m.role });
  } catch (e) { console.error(e); return json({ error: "ログインできませんでした。少し待ってからやり直してください。" }, 500); }
}
