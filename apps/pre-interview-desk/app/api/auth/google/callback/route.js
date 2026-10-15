export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { cookies } from "next/headers";
import { desk } from "../../../../../lib/db.js";
import { exchangeCode, googleEnabled } from "../../../../../lib/google.js";
import { COOKIE, SESSION_HOURS, signSession } from "../../../../../lib/session.js";

const back = (q) => new Response(null, { status: 302, headers: { Location: "/login" + (q ? "?error=" + q : "") } });

export async function GET(req) {
  if (!googleEnabled()) return back("google_off");
  const url = new URL(req.url);
  const [state, nonce] = String(cookies().get("g_oauth")?.value || "").split(".");
  cookies().delete({ name: "g_oauth", path: "/api/auth/google" });
  if (url.searchParams.get("error")) return back("google_cancel");
  if (!state || url.searchParams.get("state") !== state) return back("google_state");
  let g;
  try { g = await exchangeCode(url.searchParams.get("code") || "", nonce); }
  catch (e) { console.error("google login failed:", e.message); return back("google_failed"); }
  try {
    // 事前にメンバー登録されたメールアドレスだけがログインできる（招待制）
    const [m] = await desk("select id::text, active from desk_members where lower(email) = $1", [g.email]);
    if (!m) return back("not_member");
    if (!m.active) return back("inactive");
    await desk("update desk_members set last_login_at = now() where id = $1::uuid", [m.id]);
    cookies().set(COOKIE, await signSession({ uid: m.id }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600 });
    return new Response(null, { status: 302, headers: { Location: "/" } });
  } catch (e) { console.error(e); return back("server"); }
}
