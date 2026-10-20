import type { Room } from '../types';
export interface PlanningMeeting {id:string;participants:string[];startedAt:number;expiresAt:number;status:'active'|'ended'|'cancelled'}
export type MeetingEvent={type:'planning_meeting';eventId:string;meetingId:string;issuedAt:number;phase:'start';participants:string[];durationSeconds:number}|{type:'planning_meeting';eventId:string;meetingId:string;issuedAt:number;phase:'end'|'cancel'};
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[\x00-\x1f\x7f]/.test(value);
/** An explicit stream event is scoped to its existing room. Independent topic proxies cannot join. */
export function applyMeetingEvent(room:Room,raw:unknown,now:number):Room {
  if(room.telegram||!raw||typeof raw!=='object'||Array.isArray(raw))return room;
  const e=raw as Record<string,unknown>;
  if(e.type!=='planning_meeting'||!id(e.eventId)||!id(e.meetingId)||typeof e.issuedAt!=='number'||!Number.isFinite(e.issuedAt)||now-e.issuedAt>30000||e.issuedAt-now>5000||room.meetingEventIds?.includes(e.eventId))return room;
  let meeting:PlanningMeeting;
  if(e.phase==='start'){
    if(Object.keys(e).length!==7||!Array.isArray(e.participants)||e.participants.length<2||e.participants.length>4||new Set(e.participants).size!==e.participants.length||!e.participants.every(p=>id(p)&&room.agents.some(a=>a.id===p&&!a.topicRoomId))||typeof e.durationSeconds!=='number'||!Number.isFinite(e.durationSeconds)||e.durationSeconds<10||e.durationSeconds>120)return room;
    if(room.planningMeeting?.status==='active'&&room.planningMeeting.expiresAt>now)return room;
    meeting={id:e.meetingId,participants:[...e.participants] as string[],startedAt:now,expiresAt:now+e.durationSeconds*1000,status:'active'};
  }else if(e.phase==='end'||e.phase==='cancel'){
    if(Object.keys(e).length!==5||room.planningMeeting?.id!==e.meetingId)return room;
    meeting={...room.planningMeeting,status:e.phase==='end'?'ended':'cancelled'};
  }else return room;
  return {...room,planningMeeting:meeting,meetingEventIds:[...(room.meetingEventIds??[]),e.eventId].slice(-64)};
}

import { along, pathLength, routeBetween, SPOTS, travelDistance, travelDuration, type Spot, type XZ } from './navigation';
export interface MeetingActorSample {x:number;z:number;heading:number;walking:boolean;seated:boolean;talking:boolean;distance:number;noteTarget?:[number,number,number]}
interface Journey {id:string;home:Spot;seat:Spot;route:XZ[];distance:number;phase:'waiting'|'outbound'|'seated'|'return'|'home';started:number}
/** Serialize aisle use. Meeting chairs are reserved only if no nonparticipant occupies them. */
export class MeetingDirector {
  id:string|null=null; time=0; returning=false; journeys:Journey[]=[];
  get phase():"gathering"|"discussing"|"returning"|null {return !this.inProgress?null:this.returning?"returning":this.journeys.every(j=>j.phase==="seated")?"discussing":"gathering";}
  get inProgress(){return this.journeys.some(j=>j.phase!=="home");}
  step(dt:number,meeting:PlanningMeeting|undefined,agents:{id:string;spot:Spot;working:boolean}[],now:number,enabled:boolean):Map<string,MeetingActorSample>{
    const out=new Map<string,MeetingActorSample>();if(!enabled)return out;
    this.time+=Math.min(.25,Math.max(0,dt));
    // Stream ingestion already checks freshness. A valid replacement may wait
    // for old participants to walk home; never discard those active journeys.
    if(!this.inProgress&&meeting?.id!==this.id&&meeting?.status==='active'&&meeting.expiresAt>now){
      const free=SPOTS.slice(8).filter(seat=>!agents.some(a=>a.spot===seat&&!meeting.participants.includes(a.id)));
      if(free.length<meeting.participants.length)return out;
      const journeys:Journey[]=[],assigned=new Map<string,Spot>();
      for(const id of meeting.participants){const agent=agents.find(a=>a.id===id);if(!agent)return out;if(agent.spot.kind === "meeting"){assigned.set(id,agent.spot);free.splice(free.indexOf(agent.spot),1);}}
      for(const id of meeting.participants){const agent=agents.find(a=>a.id===id)!;const seat=assigned.get(id)??free.shift()!;if(agent.spot===seat){journeys.push({id,home:agent.spot,seat,route:[[seat.pos[0],seat.pos[2]]],distance:0,phase:"seated",started:0});continue;}const path=routeBetween(agent.spot,seat);if(!path)return out;const route=[...path,[seat.pos[0],seat.pos[2]] as XZ];journeys.push({id,home:agent.spot,seat,route,distance:0,phase:'waiting',started:0});}
      this.id=meeting.id;this.journeys=journeys;this.returning=false;
    }
    if(!this.id)return out;
    if(!meeting||meeting.id!==this.id||meeting.status!=='active'||meeting.expiresAt<=now||agents.some(a=>this.journeys.some(j=>j.id===a.id)&&a.working))this.returning=true;
    const discussing=!this.returning&&this.journeys.every(j=>j.phase === "seated");
    let moving=false;
    for(const j of this.journeys){
      const len=pathLength(j.route);
      if(j.phase==='outbound'||j.phase==='return'){
        const age=this.time-j.started,returning=j.phase==='return',route=returning?[...j.route].reverse():j.route;
        const distance=travelDistance(len,age-.8);const p=along(route,distance);
        j.distance=returning?len-distance:distance;
        out.set(j.id,{...p,walking:age>.8&&age<travelDuration(len)+.8,seated:false,talking:false,distance});
        if(age>=travelDuration(len)+.8){j.phase=returning?'home':'seated';j.started=this.time;}else moving=true;
      }else if(j.phase==='seated'){
        const speaker=Math.floor(this.time/4)%this.journeys.length,index=this.journeys.indexOf(j);
        const dx=j.seat.pos[0]+4.4,dz=j.seat.pos[2]-4,r=Math.hypot(dx,dz);
        out.set(j.id,{x:j.seat.pos[0],z:j.seat.pos[2],heading:j.seat.rot,walking:false,seated:true,talking:discussing&&speaker===index,distance:len,
          noteTarget:discussing&&(speaker+1)%this.journeys.length===index?[-4.4+dx/r*1.33,1.089,4+dz/r*1.33]:undefined});
      }
    }
    if(!moving){
      const next=this.returning?this.journeys.find(j=>j.phase==='seated'):this.journeys.find(j=>j.phase==='waiting');
      if(next){next.phase=this.returning?(next.home===next.seat?'home':'return'):'outbound';next.started=this.time;}
      if(this.returning)for(const j of this.journeys)if(j.phase==='waiting')j.phase='home';
    }
    return out;
  }
}
