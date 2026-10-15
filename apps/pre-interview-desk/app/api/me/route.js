export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json } from "../../../lib/api.js";
export const GET = route(async (req, me) => json({ me }));
