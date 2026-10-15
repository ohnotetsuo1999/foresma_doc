export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { authUrl, googleEnabled } from "../../../../lib/google.js";

export async function GET() {
  if (!googleEnabled()) return Response.redirect(new URL("/login?error=google_off", process.env.APP_BASE_URL || "http://localhost:3100"), 302);
  const state = randomBytes(24).toString("hex"), nonce = randomBytes(24).toString("hex");
  cookies().set("g_oauth", `${state}.${nonce}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  return new Response(null, { status: 302, headers: { Location: authUrl(state, nonce) } });
}
