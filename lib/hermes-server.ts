/** Server-side hermes-agent configuration (read from env, never sent to the browser). */
export function hermesConfig() {
  const base = (process.env.HERMES_API_URL ?? "").replace(/\/+$/, "");
  return {
    base, // e.g. http://127.0.0.1:8642/v1
    key: process.env.HERMES_API_KEY ?? "",
    model: process.env.HERMES_MODEL ?? "hermes-agent",
    live: base.length > 0,
  };
}

export function authHeaders(key: string): Record<string, string> {
  return key ? { Authorization: `Bearer ${key}` } : {};
}

type Msg = { role: string; content: string };

/** Builds a plausible reply for demo mode (no HERMES_API_URL configured). */
function demoReply(messages: Msg[]): string {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const name = /You are (\w+)/.exec(system)?.[1] ?? "Agent";
  const isLead = system.includes("As the lead");
  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const teammates = [...system.matchAll(/^- (\w+)(.*)$/gm)]
    .filter((m) => !m[2].includes("(LEAD)"))
    .map((m) => m[1])
    .filter((n) => n !== name);
  const topic = last.replace(/^\[.*?said\]:\s*/, "").replace(/^.*?delegated this task to you:\s*/, "").slice(0, 80);

  if (last.startsWith("Approved")) {
    return [`[[STEP: Finalize | Shipping the approved work]]`, `Thanks! It's approved and finalized. ✅`].join("\n");
  }
  if (isLead && teammates.length) {
    return [
      `[[STEP: Read your message | ${topic}]]`,
      `Got it. I'll split this up for the team.`,
      `[[STEP: Plan the work | Breaking the request into tasks]]`,
      `${teammates[0]} takes the first draft${teammates[1] ? `, ${teammates[1]} reviews it` : ""}.`,
      `[[DELEGATE: ${teammates[0]} | ${topic}]]`,
      `_Demo mode: set HERMES_API_URL to talk to your real hermes-agent._`,
    ].join("\n");
  }
  return [
    `[[STEP: Read your message | Carried over: ${topic}]]`,
    `[[STEP: Drafting | Writing a first version]]`,
    `Here's a first draft.`,
    `[[OUTPUT: Draft — ${topic.slice(0, 40)}]]`,
    `1. Goal: ${topic}\n2. Approach: short, clear, on-brand.\n3. Next: review and ship.`,
    `[[NEEDS_APPROVAL: ${name} drafted "${topic.slice(0, 50)}". It needs your approval before it goes live.]]`,
  ].join("\n");
}

export function demoStream(messages: Msg[]): ReadableStream<Uint8Array> {
  const text = demoReply(messages);
  const enc = new TextEncoder();
  const chunks = text.match(/[\s\S]{1,6}/g) ?? [];
  return new ReadableStream({
    async start(controller) {
      for (const c of chunks) {
        const payload = { choices: [{ index: 0, delta: { content: c } }] };
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
        await new Promise((r) => setTimeout(r, 25));
      }
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
