import assert from 'node:assert/strict';
import { applyMeetingEvent } from './meetings';
import { seedState } from '../seed';
const room=seedState().rooms[1],now=100000;
const start={type:'planning_meeting',phase:'start',eventId:'start-1',meetingId:'meeting-1',issuedAt:now,participants:room.agents.slice(0,2).map(a=>a.id),durationSeconds:60};
const active=applyMeetingEvent(room,start,now);assert.equal(active.planningMeeting?.status,'active');
assert.equal(applyMeetingEvent(active,start,now),active,'duplicate start cannot replay');
for(const event of [{...start,participants:['foreign','agent']},{...start,participants:[start.participants[0],start.participants[0]]},{...start,issuedAt:now-30001},{...start,durationSeconds:1000},{...start,url:'https://example.com'}])assert.equal(applyMeetingEvent(room,event,now),room);
const end={type:'planning_meeting',phase:'cancel',eventId:'cancel-1',meetingId:'meeting-1',issuedAt:now};
assert.equal(applyMeetingEvent(active,end,now).planningMeeting?.status,'cancelled');
assert.equal(applyMeetingEvent({...room,telegram:{groupId:'-1',topicId:'2',busy:false,pendingMessages:[]}},start,now).planningMeeting,undefined,'no cross-topic collaboration');
assert.equal(applyMeetingEvent(room,{text:'Plan a meeting'},now),room,'text is never an event');
console.log('PASS explicit meeting lifecycle, duplicate/freshness/participant/closed-schema validation and topic isolation');

import { MeetingDirector } from './meetings';
import { SPOTS } from './navigation';
const director=new MeetingDirector();
const agents=room.agents.map((a,i)=>({id:a.id,spot:SPOTS[i],working:false}));
let seated=false,returned=false;
for(let i=0;i<6000;i++){
 const samples=director.step(.05,active.planningMeeting,agents,now+i*50,true);
 assert.ok([...samples.values()].filter(s=>s.walking).length<=1,'only one actor uses an aisle');
 if([...samples.values()].some(s=>s.walking))assert.equal([...samples.values()].some(s=>s.talking||s.noteTarget),false,'discussion waits for all participants');
 seated ||= [...samples.values()].filter(s=>s.seated).length===2;
 if(i>1500&&samples.size===0)returned=true;
}
assert.ok(seated,'all participants sit');assert.ok(returned,'participants return after expiry');
console.log('PASS meeting chair reservations, serialized walking, sitting and expiry return');

const occupied=new MeetingDirector(),full=Array.from({length:12},(_,i)=>({id:`full-${i}`,spot:SPOTS[i],working:false}));
assert.equal(occupied.step(.05,{id:'full',participants:['full-0','full-1'],startedAt:now,expiresAt:now+120000,status:'active'},full,now,true).size,0);
const seatedDirector=new MeetingDirector(),atTable=[{id:'here',spot:SPOTS[8],working:false},{id:'join',spot:SPOTS[1],working:false}];
const existing=seatedDirector.step(.05,{id:'already-here',participants:['here','join'],startedAt:now,expiresAt:now+120000,status:'active'},atTable,now,true);
assert.equal(existing.get('here')?.seated,true);assert.equal(existing.get('here')?.walking,false);
console.log('PASS no speech to empty seats, occupied-chair rejection and already-seated participant preservation');

for (const finish of ['ended','expired'] as const) {
 const d=new MeetingDirector();
 const first={id:'A',participants:agents.slice(0,2).map(a=>a.id),startedAt:now,expiresAt:now+120000,status:'active' as const};
 for(let i=0;i<4000&&d.phase!=='discussing';i++)d.step(.05,first,agents,now,true);
 assert.equal(d.phase,'discussing');
 const ended={...first,status:finish==='ended'?'ended' as const:'active' as const,expiresAt:finish==='expired'?now:first.expiresAt};
 d.step(.05,ended,agents,now,true);
 const second={...first,id:'B',startedAt:now+50,expiresAt:now+180000};
 const before=d.journeys;
 const samples=d.step(.05,second,agents,now+50,true);
 assert.equal(d.id,'A',`${finish}: preserve the returning meeting`);
 assert.equal(d.journeys,before,`${finish}: do not replace returning journeys`);
 assert.equal(samples.size,2,`${finish}: returning participants retain positions`);
 // A delayed replacement remains valid after the stream's freshness window:
 // freshness was checked at ingestion, not when chairs finally become free.
 for(let i=0;i<6000&&String(d.id)!=='B';i++)d.step(.05,second,agents,now+40000,true);
 assert.equal(d.id,'B',`${finish}: deferred meeting starts after participants return`);
}
console.log('PASS ended/expired meeting replacements wait for all return journeys');
