import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import manifest from "../app/manifest";
const data = manifest();
assert.equal(data.display, "standalone");
assert.equal(data.start_url, "/");
assert.ok(data.icons?.some(icon => icon.sizes === "192x192"));
assert.ok(data.icons?.some(icon => icon.sizes === "512x512" && icon.purpose === "maskable"));
const handlers = new Map<string, (event: { request: { mode: string; url: string }; respondWith: (value: Promise<Response>) => void }) => void>();
let networkRequests = 0;
vm.runInNewContext(fs.readFileSync("public/sw.js", "utf8"), {
  self: { location: { origin: "https://office.test" }, addEventListener: (name: string, fn: typeof handlers extends Map<string, infer F> ? F : never) => handlers.set(name, fn), skipWaiting() {}, clients: { claim() {} } },
  fetch: async () => { networkRequests++; throw new TypeError("Offline fixture"); }, Response, URL,
  caches: { open() { throw new Error("Private office content must never enter a service-worker cache"); } },
});
async function main() {
  let response: Promise<Response> | undefined;
  handlers.get("fetch")!({ request: { mode: "navigate", url: "https://office.test/" }, respondWith: value => { response = value; } });
  assert.ok(response);
  const offline = await response;
  assert.equal(offline.status, 503);
  assert.ok((await offline.text()).includes("You’re offline"));
  assert.equal(offline.headers.get("Cache-Control"), "no-store");
  response = undefined;
  handlers.get("fetch")!({ request: { mode: "cors", url: "https://office.test/api/integrations" }, respondWith: value => { response = value; } });
  assert.equal(response, undefined, "no interception of messages, auth or SSE APIs");
  assert.equal(networkRequests, 1);
  console.log("PASS installable manifest and network-only navigation with private-data-free offline fallback");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
