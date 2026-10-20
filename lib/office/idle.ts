import {motionIdentitySeed} from '../avatar/motion';
export type IdleKind='stretch'|'look-away'|'desk-check';
export interface IdleGesture {kind:IdleKind;strength:number}
interface Memory {cycle:number;next:number;last?:IdleKind;start:number;kind?:IdleKind}
/** Weighted, seeded choices with memory. Real activity cancels a decorative gesture. */
export class IdleDirector {
 time=0;readonly memory=new Map<string,Memory>();
 step(dt:number,agents:{id:string;idle:boolean}[],enabled:boolean){
  const result=new Map<string,IdleGesture>();if(!enabled)return result;this.time+=Math.max(0,Math.min(.25,dt));
  for(const id of this.memory.keys())if(!agents.some(a=>a.id===id))this.memory.delete(id);
  for(const agent of agents){
   let m=this.memory.get(agent.id);if(!m){m={cycle:0,next:this.time+8+motionIdentitySeed(agent.id)%25,start:0};this.memory.set(agent.id,m);}
   if(!agent.idle){m.kind=undefined;m.next=this.time+15;continue;}
   if(!m.kind&&this.time>=m.next){const choices:IdleKind[]=['look-away','look-away','look-away','desk-check','desk-check','stretch'];const eligible=choices.filter(k=>k!==m!.last);m.kind=eligible[motionIdentitySeed(`${agent.id}:${m.cycle++}`)%eligible.length];m.start=this.time;m.last=m.kind;}
   if(m.kind){const age=this.time-m.start;if(age<4)result.set(agent.id,{kind:m.kind,strength:Math.sin(age/4*Math.PI)**2});else{m.kind=undefined;m.next=this.time+18+motionIdentitySeed(`${agent.id}:${m.cycle}:pause`)%37;}}
  }return result;
 }
}
