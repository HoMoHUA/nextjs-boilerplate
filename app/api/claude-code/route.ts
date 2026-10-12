import { bridgeProxy } from "@/lib/bridge-server";
import { claudeCodeConfig } from "@/lib/claude-code-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;
/** Claude Code runs under the existing account through a private local broker. */
export async function POST(req: Request) {
  if (!claudeCodeConfig().enabled) return Response.json({error: "claude_disabled"}, {status: 503});
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({error: "invalid_json"}, {status: 400}); }
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 50000)
    return Response.json({error: "invalid_prompt"}, {status: 400});
  return bridgeProxy("/claude", req, {prompt: body.prompt, systemAppend: body.systemAppend, subagents: body.subagents, sessionId: body.sessionId});
}
