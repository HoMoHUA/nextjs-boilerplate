import assert from "node:assert/strict";
import { getState, setState, startIntegrationPolling } from "./store";
import { seedState } from "./seed";
const originalFetch = globalThis.fetch, originalInterval = globalThis.setInterval, originalNow = Date.now;
const originalSource = Object.getOwnPropertyDescriptor(globalThis, "EventSource");
let clock = 100000, requests = 0, closed = false;
let tick: (() => void) | undefined;
class Source extends EventTarget {
  static current: Source;
  onerror: ((event: Event) => void) | null = null;
  constructor() { super(); Source.current = this; }
  close() { closed = true; }
}
const snapshot = () => ({ group: { id: "1", name: "Fixture" }, bots: [], rooms: [], updatedAt: clock });
const flush = () => new Promise(resolve => setImmediate(resolve));
async function main() {
  let stop: (() => void) | undefined;
  try {
    Date.now = () => clock;
    globalThis.setInterval = ((callback: () => void) => { tick = callback; return 1; }) as unknown as typeof setInterval;
    Object.defineProperty(globalThis, "EventSource", { configurable: true, value: Source });
    globalThis.fetch = async () => { requests++; return new Response(JSON.stringify(snapshot())); };
    setState(() => seedState());
    stop = startIntegrationPolling();
    await flush();
    Source.current.dispatchEvent(new MessageEvent("snapshot", { data: JSON.stringify(snapshot()) }));
    const initialRequests = requests;
    clock += 15000; tick!(); await flush();
    assert.equal(requests, initialRequests, "skip redundant refresh while SSE data is fresh");
    clock += 16000; tick!(); await flush();
    assert.equal(requests, initialRequests + 1, "healthy SSE with unchanged comment keepalives still receives a bounded freshness refresh");
    assert.equal(getState().integrations?.updatedAt, clock);
    assert.equal(getState().integrations?.observedAt, clock);
    console.log("PASS healthy unchanged SSE freshness refresh without high-frequency duplicate polling");
  } finally {
    stop?.();
    Date.now = originalNow; globalThis.fetch = originalFetch; globalThis.setInterval = originalInterval;
    if (originalSource) Object.defineProperty(globalThis, "EventSource", originalSource); else Reflect.deleteProperty(globalThis, "EventSource");
  }
  assert.ok(closed);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
