import { authHeaders, hermesConfig } from "@/lib/hermes-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = hermesConfig();
  if (!cfg.live) return Response.json({ mode: "demo", ok: true, model: null });
  try {
    const res = await fetch(`${cfg.base}/models`, {
      headers: authHeaders(cfg.key),
      signal: AbortSignal.timeout(4000),
    });
    const json = res.ok ? await res.json().catch(() => null) : null;
    return Response.json({
      mode: "live",
      ok: res.ok,
      model: json?.data?.[0]?.id ?? cfg.model,
      error: res.ok ? null : `HTTP ${res.status}`,
    });
  } catch (err) {
    return Response.json({ mode: "live", ok: false, model: cfg.model, error: (err as Error).message });
  }
}
