/* Navigation stays network-only. No chat, API, auth, scene or model responses are cached. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.mode !== "navigate" || url.origin !== self.location.origin || !["/", "/login"].includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#11161b"><title>Offline · Arklyn Office</title><style>html{color-scheme:dark}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#11161b;color:#e7ede9;font:16px/1.6 system-ui}main{max-width:30rem;padding:2rem}p{color:#a2b1b1}a{display:inline-block;color:#11161b;background:#cedbd2;padding:.65rem 1.2rem;border-radius:.7rem;text-decoration:none}a:focus-visible{outline:3px solid #a8bfff;outline-offset:4px}</style><main><h1>You’re offline</h1><p>Reconnect to open your office and send messages. Your saved browser settings have not been cleared.</p><a href="/">Try again</a></main></html>`, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })));
});
