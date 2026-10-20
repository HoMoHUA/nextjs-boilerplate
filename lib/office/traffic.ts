import { along,pathLength,travelDistance,travelDuration,type XZ } from './navigation';
export interface HandoffTrip {id:string;owner:string;route:XZ[];face:XZ;ts:number}
export interface HandoffSample {owner:string;x:number;z:number;heading:number;walking:boolean;seated:boolean;talking:boolean;distance:number}
/** One shared aisle reservation; explicit handoffs queue and take priority over idle breaks. */
export class TrafficDirector {
  queue:HandoffTrip[]=[];active:HandoffTrip|null=null;age=0;
  readonly seen=new Map<string,number>();
  get pending(){return !!this.active||this.queue.length>0;}
  enqueue(events:HandoffTrip[],now:number){
    for(const [id,ts]of this.seen)if(now-ts>120000)this.seen.delete(id);
    for(const e of events){if(this.seen.has(e.id)||now-e.ts>30000||e.ts-now>5000)continue;this.seen.set(e.id,e.ts);if(this.queue.length<12)this.queue.push(e);}
    this.queue=this.queue.filter(e=>now-e.ts<60000);
  }
  step(dt:number,canStart:boolean,enabled:boolean):HandoffSample|null {
    if(!enabled)return null;
    if(!this.active&&canStart){this.active=this.queue.shift()??null;this.age=0;}
    const trip=this.active;if(!trip)return null;
    this.age+=Math.max(0,Math.min(.25,dt));
    const len=pathLength(trip.route),walk=travelDuration(len),age=this.age;
    if(age>1.6+2*walk+2.2){this.active=null;return null;}
    let distance=0,route=trip.route,walking=false,seated=false,talking=false;
    if(age<.8)seated=age<.12;
    else if(age<.8+walk){distance=travelDistance(len,age-.8);walking=true;}
    else if(age<.8+walk+2.2){distance=len;talking=true;}
    else {route=[...trip.route].reverse();distance=travelDistance(len,age-.8-walk-2.2);walking=age<.8+2*walk+2.2;seated=!walking;}
    const p=along(route,distance);
    return{owner:trip.owner,...p,heading:talking?Math.atan2(trip.face[0]-p.x,trip.face[1]-p.z):p.heading,walking,seated,talking,distance};
  }
}
