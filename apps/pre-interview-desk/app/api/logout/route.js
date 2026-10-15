export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { cookies } from "next/headers";
import { COOKIE } from "../../../lib/session.js";
import { json } from "../../../lib/api.js";
export async function POST() { cookies().delete(COOKIE); return json({ ok: true }); }
