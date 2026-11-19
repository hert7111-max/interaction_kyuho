/** A seated, nearly centred viewpoint: the desktop recedes horizontally beneath the CRT. */
export function arcadeView(aspect:number){
 const fov=43,tan=Math.tan(fov*Math.PI/360),distance=Math.max(7.4,4.65/(2*tan*Math.max(.25,aspect))*1.10+.35)
 return{fov,position:[.10,2.45,distance] as const,target:[0,1.10,-.6] as const,controllerScale:Math.min(.74,.74*aspect/1.15)}
}
export const CONTROLLER_Y=-.83
