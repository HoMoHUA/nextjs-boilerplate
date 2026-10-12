import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, publicOrigin, verifySession } from "@/lib/auth";

/** Guards every page and API route behind the office password (no-op when OFFICE_PASSWORD is unset). */
export async function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, publicOrigin(req)), 307);
}

export const config = {
  // everything except the login flow, the health check and static assets
  matcher: ["/((?!login|api/login|api/health|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
