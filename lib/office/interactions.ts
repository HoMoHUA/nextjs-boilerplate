import { motionIdentitySeed } from '../avatar/motion';
import { along, COFFEE_STAND, pathLength, routeFromSeat, travelDistance, travelDuration, type Spot, type XZ } from './navigation';
export type CoffeePhase = 'stand'|'outbound'|'prepare'|'press'|'brew'|'pickup'|'sip'|'replace'|'return'|'sit';
export interface Visitor { id:string; spot:Spot; idle:boolean }
export interface CoffeeSample { owner:string; phase:CoffeePhase; x:number; z:number; heading:number; seated:boolean; walking:boolean; distance:number; hand:'rest'|'button'|'cup'|'sip'|'carry'; carrying:boolean; brew:boolean }
interface Visit { owner:string; route:XZ[]; start:number; interruptedAt?:number; returnRoute?:XZ[]; replacing?:boolean }
const STAGES:[CoffeePhase,number][]=[['prepare',1.4],['press',1.1],['brew',6.5],['pickup',1.2],['sip',4.2],['replace',1.2]];
function delay(id:string,cycle:number){return 24+(motionIdentitySeed(`${id}:${cycle}`)%4200)/100;}
/** Local decoration only: one reservation, seeded cooldown, no network and no execution state mutations. */
export class CoffeeDirector {
  time=0;
  active:Visit|null=null;
  readonly next=new Map<string,number>();
  readonly cycles=new Map<string,number>();
  lastOwner:string|null=null;
  availableAt=0;
  step(dt:number,visitors:Visitor[],enabled:boolean,blocked=false):CoffeeSample|null {
    // Pause rather than catching up after hidden tabs or long shader compilation.
    if(!enabled)return null;
    this.time+=Math.max(0,Math.min(.25,dt));
    for(const v of visitors)if(!this.next.has(v.id))this.next.set(v.id,this.time+delay(v.id,0));
    for(const id of this.next.keys())if(!visitors.some(v=>v.id===id))this.next.delete(id);
    if(this.active){
      const owner=visitors.find(v=>v.id===this.active!.owner);
      if(!owner){this.active=null;return null;}
      if((!owner.idle||blocked)&&this.active.interruptedAt===undefined){
        const current=this.sample();
        // Reverse only the part already travelled. No teleport, no route through furniture.
        const dist=current.phase==='outbound'?current.distance:pathLength(this.active.route);
        if(current.phase==='stand'){this.finish();return null;}
        if(!['return','sit'].includes(current.phase)){
          const partial:XZ[]=[this.active.route[0]];let left=dist;
          for(let i=1;i<this.active.route.length;i++){
            const a=this.active.route[i-1],b=this.active.route[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
            if(left>=len){partial.push(b);left-=len;}else {partial.push([current.x,current.z]);break;}
          }
          this.active.interruptedAt=this.time;this.active.returnRoute=partial.reverse();this.active.replacing=current.carrying;
        }
      }
      const sample=this.sample();
      const len=pathLength(this.active.returnRoute??this.active.route);
      if(this.active.interruptedAt!==undefined&&this.time-this.active.interruptedAt>travelDuration(len)+.8+(this.active.replacing?1.4:0)){this.finish();return null;}
      if(sample.phase==='sit'&&this.time-this.active.start>this.duration()+.8){this.finish();return null;}
      return sample;
    }
    if(blocked||this.time<this.availableAt)return null;
    const eligible=visitors.filter(v=>v.idle&&this.time>=(this.next.get(v.id)??Infinity));
    // Prevent consecutive trips by the same person when another is available.
    eligible.sort((a,b)=>Number(a.id===this.lastOwner)-Number(b.id===this.lastOwner)||(this.next.get(a.id)!-this.next.get(b.id)!));
    for(const v of eligible){const route=routeFromSeat(v.spot,COFFEE_STAND);if(route){this.active={owner:v.id,route,start:this.time};return this.sample();}this.next.set(v.id,this.time+60);}
    return null;
  }
  private duration(){return .8+2*travelDuration(pathLength(this.active!.route))+STAGES.reduce((s,[,t])=>s+t,0);}
  private finish(){if(!this.active)return;const id=this.active.owner,cycle=(this.cycles.get(id)??0)+1;this.cycles.set(id,cycle);this.next.set(id,this.time+240+delay(id,cycle)*3);this.availableAt=this.time+30+delay(id,cycle)/2;this.lastOwner=id;this.active=null;}
  private sample():CoffeeSample {
    const v=this.active!,len=pathLength(v.route),walk=travelDuration(len);let age=this.time-v.start;
    let phase:CoffeePhase='stand',distance=0,route=v.route,carrying=false;
    if(v.interruptedAt!==undefined){route=v.returnRoute!;const rlen=pathLength(route);age=this.time-v.interruptedAt;if(v.replacing&&age<1.4){phase='replace';route=v.route;distance=len;carrying=true;}else{age-=v.replacing?1.4:0;phase=age<travelDuration(rlen)?'return':'sit';distance=travelDistance(rlen,age);}}
    else if(age<.8)phase='stand';
    else if((age-=.8)<walk){phase='outbound';distance=travelDistance(len,age);}
    else {
      age-=walk;distance=len;
      let found=false;
      for(const [name,seconds]of STAGES){if(age<seconds){phase=name;found=true;break;}age-=seconds;}
      if(!found){route=[...v.route].reverse();distance=travelDistance(len,age);phase=age<walk?'return':'sit';}
      carrying=phase==='sip'||phase==='replace';
    }
    const p=along(route,distance),atStation=['prepare','press','brew','pickup','sip','replace'].includes(phase);
    return{owner:v.owner,phase,x:p.x,z:p.z,heading:atStation?Math.PI:p.heading,seated:phase==='sit',walking:phase==='outbound'||phase==='return',distance,hand:phase==='press'?'button':phase==='pickup'||phase==='replace'?'cup':phase==='sip'?(age%2.1<.95?'sip':'carry'):'rest',carrying,brew:phase==='brew'};
  }
}
