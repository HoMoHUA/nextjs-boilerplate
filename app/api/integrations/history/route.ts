import { bridgeProxy } from "@/lib/bridge-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req:Request) {
  const query=new URL(req.url).searchParams;
  const roomId=query.get("roomId"),before=query.get("before");
  if([...query.keys()].some(k=>k!=="roomId" && k!=="before") || !roomId || !/^tg-topic-[1-9]\d{0,9}$/.test(roomId) || (before!==null && !/^[1-9]\d{0,9}$/.test(before)))return Response.json({error:"invalid_history_query"},{status:400});
  const q=new URLSearchParams({roomId});if(before)q.set("before",before);
  return bridgeProxy(`/history?${q}`,req);
}
