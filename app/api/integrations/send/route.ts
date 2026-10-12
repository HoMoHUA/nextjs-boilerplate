import { bridgeProxy } from "@/lib/bridge-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  let body: {roomId?: string; text?: string};
  try { body = await req.json(); } catch { return Response.json({error: "invalid_json"}, {status: 400}); }
  if (typeof body.roomId !== "string" || typeof body.text !== "string" || !body.text.trim() || body.text.length > 3500)
    return Response.json({error: "invalid_message"}, {status: 400});
  return bridgeProxy("/send", req, {roomId: body.roomId, text: body.text});
}
