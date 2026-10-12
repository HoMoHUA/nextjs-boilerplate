/**
 * Events the Claude Code backend streams to the office UI. `agent` is a subagent
 * type, or null for the main (lead) thread; `parent` is the Agent tool call the
 * event belongs to.
 */
export type OfficeEvent =
  | { type: "session"; id: string; agents: string[] }
  | { type: "text"; agent: string | null; parent: string | null; delta: string }
  | { type: "tool"; agent: string | null; parent: string | null; name: string; detail: string }
  | { type: "subagent_start"; toolUseId: string; agent: string; task: string }
  | { type: "subagent_progress"; toolUseId: string; agent: string; text: string; tool?: string }
  | { type: "subagent_end"; toolUseId: string; agent: string; summary: string; ok: boolean }
  | { type: "result"; ok: boolean; text: string; costUsd?: number; sessionId: string }
  | { type: "error"; message: string }
  | { type: "done" };

export async function readOfficeEvents(res: Response, onEvent: (e: OfficeEvent) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      try {
        onEvent(JSON.parse(line.slice(5)) as OfficeEvent);
      } catch {
        // ignore malformed frame
      }
    }
  }
}
