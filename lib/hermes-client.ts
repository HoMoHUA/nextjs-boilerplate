export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Streams a reply from /api/hermes (OpenAI-compatible SSE), calling onDelta with each chunk. */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/hermes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Hermes request failed (${res.status})`);
  }

  // Non-streaming fallback
  if (!res.headers.get("content-type")?.includes("text/event-stream")) {
    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    onDelta(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return full;
      try {
        const json = JSON.parse(data);
        const chunk: string = json?.choices?.[0]?.delta?.content ?? "";
        if (chunk) {
          full += chunk;
          onDelta(chunk);
        }
      } catch {
        // ignore keep-alive / partial lines
      }
    }
  }
  return full;
}
