/**
 * Password login for production. When OFFICE_PASSWORD is set, every page and
 * API route requires a signed session cookie (see proxy.ts). Uses Web Crypto
 * so it runs in the proxy and in route handlers alike.
 */
export const SESSION_COOKIE = "office_session";
export const SESSION_DAYS = 30;

export const authEnabled = () => Boolean(process.env.OFFICE_PASSWORD);

function secret() {
  return process.env.OFFICE_SESSION_SECRET || `office:${process.env.OFFICE_PASSWORD ?? ""}`;
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Buffer.from(sig).toString("base64url");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function createSession() {
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  return `${expires}.${await hmac(String(expires))}`;
}

export async function verifySession(token: string | undefined) {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return safeEqual(sig, await hmac(expires));
}

/**
 * The origin the browser used. Behind a reverse proxy the server itself only
 * sees 127.0.0.1:<port>, so prefer the forwarded headers (Caddy sets them).
 */
export function publicOrigin(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

/** Redirect to a path on the public origin (correct behind a reverse proxy). */
export function redirectTo(req: Request, path: string, status = 303) {
  return new Response(null, { status, headers: { Location: publicOrigin(req) + path } });
}
