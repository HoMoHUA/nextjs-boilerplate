import { bridgeProxy } from "@/lib/bridge-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  let body: {roomId?: string; text?: string; backend?: "hermes" | "claude-code"};
  try { body = await req.json(); } catch { return Response.json({error: "invalid_json"}, {status: 400}); }
  if (!body || typeof body !== "object" || typeof body.roomId !== "string" || typeof body.text !== "string" || !body.text.trim() || body.text.length > 3500)
    return Response.json({error: "invalid_message"}, {status: 400});
  if (body.backend !== undefined && body.backend !== "hermes" && body.backend !== "claude-code") return Response.json({error:"invalid_backend"},{status:400});
  return bridgeProxy("/send", req, {roomId: body.roomId, text: body.text, backend:body.backend});
}
