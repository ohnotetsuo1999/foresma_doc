export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json, body } from "../../../../lib/api.js";
import { saveToss } from "../../../../lib/desk.js";
export const PUT = route(async (req, me) => { const b = await body(req); return json(await saveToss(me, b.id, b.fmt)); });
