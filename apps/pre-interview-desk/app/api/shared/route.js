export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json } from "../../../lib/api.js";
import { shared } from "../../../lib/desk.js";
export const GET = route(async () => json(await shared()));
