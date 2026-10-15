export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json, body } from "../../../lib/api.js";
import { acquireHold, releaseHold } from "../../../lib/desk.js";
export const POST = route(async (req, me) => { const b = await body(req); return json(await acquireHold(me, b.slotStart, b.hubUserId)); });
export const DELETE = route(async (req, me) => { await releaseHold(me, new URL(req.url).searchParams.get("id")); return json({ ok: true }); });
