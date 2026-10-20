/** World-space mug handle/rim offsets for the authored mug at .621 scale. */
export function mugHandleOffset(tilt:number):[number,number,number]{return [.065,.07*Math.cos(tilt),.07*Math.sin(tilt)];}
export function drinkingGrip(mouth:[number,number,number],forward:[number,number,number],tilt:number):[number,number,number]{
 const rise=.0418*Math.cos(tilt)-.05*Math.sin(tilt),reach=.0418*Math.sin(tilt)+.05*Math.cos(tilt);
 return[mouth[0]+.065+forward[0]*reach,mouth[1]-rise,mouth[2]+forward[2]*reach];
}
