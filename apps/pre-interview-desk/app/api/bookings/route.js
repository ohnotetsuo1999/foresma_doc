export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json, body } from "../../../lib/api.js";
import { createBooking } from "../../../lib/desk.js";
export const POST = route(async (req, me) => json(await createBooking(me, await body(req))));
