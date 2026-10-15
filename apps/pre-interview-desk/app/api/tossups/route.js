export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json } from "../../../lib/api.js";
import { tossups } from "../../../lib/desk.js";
export const GET = route(async req => json({ tossups: await tossups(new URL(req.url).searchParams.get("userId")) }));
