/** Shared world-space layout. Keep navigation and furniture on the same coordinates. */
export type XZ = [number, number];
export interface Spot { pos: [number, number, number]; rot: number; kind: 'lead' | 'desk' | 'meeting' }
export const TABLE: XZ = [-4.4, 4];
export function meetingSeat(a: number): Spot {
  const x = TABLE[0] + Math.sin(a) * 1.75, z = TABLE[1] + Math.cos(a) * 1.75;
  return { pos: [x, 0, z], rot: Math.atan2(TABLE[0]-x, TABLE[1]-z), kind: 'meeting' };
}
export const DESKS: Spot[] = [[-4.6,.4],[-1.6,.4],[1.3,.4],[-1.6,-3.8],[1.3,-3.8],[4.2,.4],[4.2,-3.8],[-4.6,-3.8]].map(([x,z],i)=>({pos:[x,0,z],rot:0,kind:i===0?'lead':'desk'}));
export const SPOTS = [...DESKS, ...[.8,-.8,2.35,-2.35].map(meetingSeat)];
export const COFFEE_STAND: XZ = [5.75,-4.5];
export const COFFEE_CUP: [number,number,number] = [5.74,1.125,-5.07];
// Front surface of the authored brew button's amber center, not the control dial.
export const COFFEE_BUTTON: [number,number,number] = [5.787,1.376,-5.144];
export const BODY_RADIUS = .34;
type Rect = { x: number; z: number; hx: number; hz: number };
const obstacles: Rect[] = [
  ...DESKS.map(s=>({x:s.pos[0],z:s.pos[2]+.864,hx:s.kind==='lead'?1.418:1.08,hz:.5})),
  {x:6.1,z:-5.25,hx:.83,hz:.4}, {x:6.2,z:3,hx:.8,hz:.8},
  {x:3.8,z:5.1,hx:1.2,hz:.38}, {x:6.8,z:.9,hx:.35,hz:.8},
  {x:-7,z:-4.2,hx:.4,hz:.65},
  ...[[7,-2.6],[-7,5.6],[7,5.4],[.6,5.2]].map(([x,z])=>({x,z,hx:.3,hz:.3})),
];
export function walkable([x,z]: XZ) {
  return x>=-7.5+BODY_RADIUS && x<=7.5-BODY_RADIUS && z>=-5.9+BODY_RADIUS && z<=5.9-BODY_RADIUS &&
    Math.hypot(x-TABLE[0],z-TABLE[1])>=1.5+BODY_RADIUS &&
    !SPOTS.some(s=>Math.hypot(x-s.pos[0],z-s.pos[2])<.46+BODY_RADIUS) &&
    !obstacles.some(o=>Math.abs(x-o.x)<o.hx+BODY_RADIUS && Math.abs(z-o.z)<o.hz+BODY_RADIUS);
}
export function segmentClear(a:XZ,b:XZ) {
  const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.07));
  for(let i=0;i<=n;i++) if(!walkable([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]))return false;
  return true;
}
/** Grid A* with exact endpoint checks and line-of-sight smoothing. Never falls back to a colliding line. */
export function findPath(start:XZ,end:XZ):XZ[]|null {
  if(!walkable(start)||!walkable(end)) return null;
  if(segmentClear(start,end))return [start,end];
  const step=.14, nx=108, nz=84;
  const point=(id:number):XZ=>[-7.5+(id%nx)*step,-5.9+Math.floor(id/nx)*step];
  const nearest=(p:XZ)=>{
    let best=-1,d=Infinity;
    const cx=Math.round((p[0]+7.5)/step),cz=Math.round((p[1]+5.9)/step);
    for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
      const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=nx||z>=nz)continue;
      const id=z*nx+x,q=point(id),dd=Math.hypot(q[0]-p[0],q[1]-p[1]);
      if(dd<d&&segmentClear(p,q)){d=dd;best=id;}
    }return best;
  };
  const first=nearest(start),last=nearest(end);if(first<0||last<0)return null;
  const cost=new Float64Array(nx*nz).fill(Infinity),parent=new Int32Array(nx*nz).fill(-1),closed=new Uint8Array(nx*nz);
  const goal=point(last),open=new Set([first]);cost[first]=0;
  while(open.size){
    let current=-1,best=Infinity;
    for(const id of open){const p=point(id),f=cost[id]+Math.hypot(p[0]-goal[0],p[1]-goal[1]);if(f<best){best=f;current=id;}}
    if(current===last){
      const raw:XZ[]=[end];for(let id=current;id!==-1;id=parent[id])raw.push(point(id));raw.push(start);raw.reverse();
      const smooth:XZ[]=[raw[0]];let i=0;
      while(i<raw.length-1){let j=raw.length-1;while(j>i+1&&!segmentClear(raw[i],raw[j]))j--;smooth.push(raw[j]);i=j;}
      return smooth;
    }
    open.delete(current);closed[current]=1;const x=current%nx,z=Math.floor(current/nx);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dz)continue;const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=nx||zz>=nz)continue;
      const id=zz*nx+xx;if(closed[id]||!segmentClear(point(current),point(id)))continue;
      const next=cost[current]+Math.hypot(dx,dz)*step;
      if(next<cost[id]){cost[id]=next;parent[id]=current;open.add(id);}
    }
  }return null;
}
/** Stand, leave sideways through the open front of the chair, then join the aisle. */
export function seatExit(spot:Spot):XZ[]|null {
  const [x,,z]=spot.pos;
  const choices=spot.kind==='meeting'?[1,-1]:[-1,1];
  for(const sign of choices){
    const angle=spot.rot, right:XZ=[Math.cos(angle)*sign, -Math.sin(angle)*sign];
    const side:XZ=[x+right[0]*.96,z+right[1]*.96];
    if(walkable(side))return [[x,z],side];
  }return null;
}
export function routeFromSeat(spot:Spot,end:XZ):XZ[]|null {
  const exit=seatExit(spot);if(!exit)return null;const path=findPath(exit[exit.length-1],end);
  return path?[...exit,...path.slice(1)]:null;
}
export function routeBetween(from:Spot,to:Spot):XZ[]|null {
  const target=seatExit(to);return target?routeFromSeat(from,target[target.length-1]):null;
}
export function pathLength(pts:XZ[]) {let d=0;for(let i=1;i<pts.length;i++)d+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return d;}
export function along(pts:XZ[],distance:number){
  let d=Math.max(0,distance);
  for(let i=1;i<pts.length;i++){const [x,z]=pts[i-1],[xx,zz]=pts[i],length=Math.hypot(xx-x,zz-z);if(d<=length||i===pts.length-1){const t=length?Math.min(1,d/length):1;return{x:x+(xx-x)*t,z:z+(zz-z)*t,heading:Math.atan2(xx-x,zz-z)};}d-=length;}
  return{x:pts[0][0],z:pts[0][1],heading:0};
}
/** Smooth acceleration and braking, with peak speed 1.55 and zero speed at both ends. */
export function travelDuration(length:number){return length/1.55+.8;}
export function travelDistance(length:number,time:number){
  const duration=travelDuration(length),ramp=Math.min(.8,duration/2),peak=length/(duration-ramp),t=Math.max(0,Math.min(duration,time));
  if(t<ramp)return peak*t*t/(2*ramp);
  if(t>duration-ramp)return length-peak*(duration-t)**2/(2*ramp);
  return peak*(t-ramp/2);
}
