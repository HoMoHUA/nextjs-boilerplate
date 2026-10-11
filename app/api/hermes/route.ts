import { authHeaders, demoStream, hermesConfig } from "@/lib/hermes-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

/** Proxies chat completions to hermes-agent's OpenAI-compatible API server. */
export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: { role: string; content: string }[] };
  if (!Array.isArray(messages)) return new Response("messages is required", { status: 400 });

  const cfg = hermesConfig();
  if (!cfg.live) return new Response(demoStream(messages), { headers: SSE_HEADERS });

  let upstream: Response;
  try {
    upstream = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(cfg.key) },
      body: JSON.stringify({ model: cfg.model, messages, stream: true }),
      signal: req.signal,
    });
  } catch (err) {
    return new Response(`Cannot reach hermes-agent at ${cfg.base}: ${(err as Error).message}`, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(`hermes-agent returned ${upstream.status}: ${detail}`, { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  return new Response(upstream.body, {
    headers: type.includes("event-stream") ? SSE_HEADERS : { "Content-Type": type || "application/json" },
  });
}
