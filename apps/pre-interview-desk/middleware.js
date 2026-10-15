import { NextResponse } from "next/server";
import { COOKIE, readSession } from "./lib/session.js";

const PUBLIC = ["/login", "/login.html", "/api/login", "/api/auth/config", "/api/auth/google", "/api/auth/google/callback", "/favicon.ico"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();
  const s = await readSession(req.cookies.get(COOKIE)?.value);
  if (s) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = "";
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
