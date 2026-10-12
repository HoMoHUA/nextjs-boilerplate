import { authEnabled } from "@/lib/auth";
import { claudeCodeConfig } from "@/lib/claude-code-server";
import { hermesConfig } from "@/lib/hermes-server";
import pkg from "@/package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public liveness probe for deploy scripts and uptime monitors (no secrets). */
export async function GET() {
  return Response.json({
    ok: true,
    app: "hermes-office",
    version: pkg.version,
    auth: authEnabled(),
    hermes: hermesConfig().live ? "live" : "demo",
    claudeCode: claudeCodeConfig().enabled,
  });
}
