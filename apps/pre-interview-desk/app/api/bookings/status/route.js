export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json } from "../../../../lib/api.js";
import { hubStatus } from "../../../../lib/desk.js";
export const GET = route(async req => json({ status: await hubStatus(new URL(req.url).searchParams.get("hubId")) }));
