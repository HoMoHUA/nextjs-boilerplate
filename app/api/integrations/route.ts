import { bridgeProxy } from "@/lib/bridge-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return bridgeProxy("/snapshot"); }
