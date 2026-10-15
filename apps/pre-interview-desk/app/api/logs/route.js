export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json, body } from "../../../lib/api.js";
import { addLog } from "../../../lib/desk.js";
export const POST = route(async (req, me) => json(await addLog(me, await body(req))));
