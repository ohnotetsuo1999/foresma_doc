export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json, body, bad } from "../../../lib/api.js";
import { desk } from "../../../lib/db.js";
import { hashPassword } from "../../../lib/password.js";

export const GET = route(async () => json({ members: await desk("select id::text, email, name, role, company, active, last_login_at, created_at from desk_members order by active desc, company, name") }), { admin: true });

export const POST = route(async req => {
  const b = await body(req);
  const email = String(b.email || "").trim().toLowerCase(), name = String(b.name || "").trim(), company = String(b.company || "").trim();
  const role = b.role === "admin" ? "admin" : "agent", pw = String(b.password || "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad("メールアドレスが正しくありません");
  if (!name) throw bad("名前を入れてください");
  if (pw.length < 10) throw bad("パスワードは10文字以上にしてください");
  try {
    const [m] = await desk("insert into desk_members (email, name, role, company, password_hash) values ($1, $2, $3, $4, $5) returning id::text", [email, name, role, company, await hashPassword(pw)]);
    return json({ ok: true, id: m.id });
  } catch (e) { if (e.code === "23505") throw bad("このメールアドレスはすでに登録されています"); throw e; }
}, { admin: true });

export const PATCH = route(async (req, me) => {
  const b = await body(req);
  if (!/^[0-9a-f-]{36}$/i.test(String(b.id))) throw bad("メンバーを選び直してください");
  if (b.id === me.id && b.active === false) throw bad("自分自身は無効にできません");
  if (typeof b.active === "boolean") await desk("update desk_members set active = $1 where id = $2::uuid", [b.active, b.id]);
  if (b.password) { if (String(b.password).length < 10) throw bad("パスワードは10文字以上にしてください"); await desk("update desk_members set password_hash = $1 where id = $2::uuid", [await hashPassword(String(b.password)), b.id]); }
  return json({ ok: true });
}, { admin: true });
