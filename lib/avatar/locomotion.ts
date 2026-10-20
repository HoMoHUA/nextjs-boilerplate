/** Distance-driven stance/swing. During stance, world travel + relative foot Z is constant. */
export function footTarget(distance:number,side:number){
 const period=Math.PI*2,phase=((distance*8+(side?Math.PI:0))%period+period)%period;
 const halfStride=Math.PI/16;
 if(phase<Math.PI)return{z:halfStride-phase/8,lift:0,stance:true};
 const t=(phase-Math.PI)/Math.PI,smooth=t*t*(3-2*t);
 return{z:-halfStride+2*halfStride*smooth,lift:Math.sin(t*Math.PI)*.075,stance:false};
}
/** Sagittal two-bone solution, with a flat sole. Inputs are hip-to-ankle height and forward distance. */
export function solveLeg(height:number,z:number,lower=.286){
 const upper=.3,requested=Math.hypot(height,z),distance=Math.min(upper+lower-.0001,Math.max(.04,requested));
 const hip=Math.atan2(-z,height)-Math.acos(Math.max(-1,Math.min(1,(upper*upper+distance*distance-lower*lower)/(2*upper*distance))));
 const knee=Math.PI-Math.acos(Math.max(-1,Math.min(1,(upper*upper+lower*lower-distance*distance)/(2*upper*lower))));
 return{hip,knee,foot:-(hip+knee),reachable:requested<=upper+lower};
}
