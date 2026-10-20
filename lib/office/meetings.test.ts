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
 seated ||= [...samples.values()].filter(s=>s.seated).length===2;
 if(i>1500&&samples.size===0)returned=true;
}
assert.ok(seated,'all participants sit');assert.ok(returned,'participants return after expiry');
console.log('PASS meeting chair reservations, serialized walking, sitting and expiry return');
