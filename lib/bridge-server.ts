import { cookies } from "next/headers";
import { authEnabled, SESSION_COOKIE, verifySession } from "./auth";

/** Private loopback broker keeps Telegram/Claude credentials out of the web process. */
export async function bridgeProxy(path: string, req?: Request, payload?: unknown) {
  if (!authEnabled() || !(await verifySession((await cookies()).get(SESSION_COOKIE)?.value)))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (req && process.env.OFFICE_PUBLIC_URL && req.headers.get("origin") &&
      req.headers.get("origin") !== new URL(process.env.OFFICE_PUBLIC_URL).origin)
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  const base = process.env.ARKLYN_BRIDGE_URL;
  const key = process.env.ARKLYN_BRIDGE_KEY;
  if (!base || !key) return Response.json({ error: "integration_not_configured" }, { status: 503 });
  try {
    const upstream = await fetch(`${base}${path}`, {
      method: payload === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${key}`, ...(payload === undefined ? {} : { "Content-Type": "application/json" }) },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: req ? AbortSignal.any([req.signal, AbortSignal.timeout(810_000)]) : AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    return new Response(upstream.body, { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no",
    }});
  } catch {
    return Response.json({ error: "integration_unavailable" }, { status: 502 });
  }
}
