import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS, authEnabled, createSession, publicOrigin, redirectTo, safeEqual } from "@/lib/auth";

export const runtime = "nodejs";

// naive in-memory brute-force brake: 8 attempts per IP per 10 minutes
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const back = (error: string) => redirectTo(req, `/login?error=${error}&next=${encodeURIComponent(safeNext)}`);

  if (!authEnabled()) return redirectTo(req, safeNext);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.until > now && a.n >= 8) return back("locked");

  if (!safeEqual(password, process.env.OFFICE_PASSWORD!)) {
    attempts.set(ip, { n: (a && a.until > now ? a.n : 0) + 1, until: now + 10 * 60_000 });
    return back("wrong");
  }
  attempts.delete(ip);

  const res = new NextResponse(null, { status: 303, headers: { Location: publicOrigin(req) + safeNext } });
  res.cookies.set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.OFFICE_INSECURE_COOKIE !== "true",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}
