import { cookies } from "next/headers";
import { desk } from "./db.js";
import { COOKIE, readSession } from "./session.js";

export const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function currentMember() {
  const s = await readSession(cookies().get(COOKIE)?.value);
  if (!s) return null;
  // 無効化されたメンバーはセッションが残っていても使えないよう、毎回確かめる
  const [m] = await desk("select id::text, email, name, role, company, active from desk_members where id = $1", [s.uid]);
  return m && m.active ? m : null;
}

/** ログイン必須のAPI。admin: true なら管理者だけ */
export function route(handler, { admin = false } = {}) {
  return async (req, ctx) => {
    try {
      const me = await currentMember();
      if (!me) return json({ error: "ログインしてください" }, 401);
      if (admin && me.role !== "admin") return json({ error: "管理者だけが使えます" }, 403);
      return await handler(req, me, ctx);
    } catch (e) {
      console.error(e);
      return json({ error: e.publicMessage || "サーバーでエラーが起きました。少し待ってからやり直してください。" }, e.status || 500);
    }
  };
}
export const bad = (msg, status = 400) => Object.assign(new Error(msg), { publicMessage: msg, status });
export async function body(req) { try { return await req.json(); } catch { throw bad("送信内容を読み取れませんでした"); } }
