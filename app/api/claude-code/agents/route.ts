import { claudeCodeConfig, listFileSubagents } from "@/lib/claude-code-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subagents defined on disk, so they can be imported into a room. */
export async function GET() {
  const cfg = claudeCodeConfig();
  if (!cfg.enabled) return Response.json({ enabled: false, agents: [] });
  return Response.json({ enabled: true, cwd: cfg.cwd, agents: await listFileSubagents(cfg.cwd) });
}
