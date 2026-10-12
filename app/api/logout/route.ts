import { NextResponse } from "next/server";
import { SESSION_COOKIE, publicOrigin } from "@/lib/auth";

export async function POST(req: Request) {
  const res = new NextResponse(null, { status: 303, headers: { Location: publicOrigin(req) + "/login" } });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
