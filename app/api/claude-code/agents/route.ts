import { bridgeProxy } from "@/lib/bridge-server";
import { claudeCodeConfig } from "@/lib/claude-code-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!claudeCodeConfig().enabled) return Response.json({enabled: false, agents: []});
  return bridgeProxy("/claude/agents");
}
