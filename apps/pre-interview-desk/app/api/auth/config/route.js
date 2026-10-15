export const dynamic = "force-dynamic";
import { googleEnabled } from "../../../../lib/google.js";
export async function GET() {
  return Response.json({ google: googleEnabled(), password: process.env.PASSWORD_LOGIN !== "0" }, { headers: { "Cache-Control": "no-store" } });
}
