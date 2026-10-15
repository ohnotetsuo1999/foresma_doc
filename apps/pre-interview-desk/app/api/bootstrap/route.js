export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { route, json } from "../../../lib/api.js";
import { latestSlots, staffList, shared } from "../../../lib/desk.js";
export const GET = route(async (req, me) => {
  const [s, staff, sh] = await Promise.all([latestSlots(), staffList(), shared()]);
  return json({ me, ...s, staff, shared: sh });
});
