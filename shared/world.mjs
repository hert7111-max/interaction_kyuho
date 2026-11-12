export const ROOM = { minX:-9, maxX:9, minZ:-5.4, maxZ:7, speed:2.8, radius:.35, capacity:32 }
export const COLUMNS = [{x:-6,z:-1.1},{x:6,z:-1.1},{x:-6,z:4.2},{x:6,z:4.2}]
export const ACTIONS = ['dance','idle','lie','wave']
export const clamp = (n,a,b)=>Math.max(a,Math.min(b,n))
export function movePosition(x,z,dx,dz,dt){
  const length=Math.max(1,Math.hypot(dx,dz)),step=ROOM.speed*Math.min(.1,Math.max(0,dt))
  let nx=clamp(x+dx/length*step,ROOM.minX,ROOM.maxX),nz=clamp(z+dz/length*step,ROOM.minZ,ROOM.maxZ)
  for(const pole of COLUMNS){const vx=nx-pole.x,vz=nz-pole.z,d=Math.hypot(vx,vz),r=.48+ROOM.radius;if(d<r){if(d<.001){nx=pole.x+r}else{nx=pole.x+vx/d*r;nz=pole.z+vz/d*r}}}
  return {x:clamp(nx,ROOM.minX,ROOM.maxX),z:clamp(nz,ROOM.minZ,ROOM.maxZ)}
}
export const COLORS=['#ff3d9a','#a855ff','#19dce7','#ffca28','#a4ec2b','#ff6340','#4a80ff','#ff72bf','#b6ff4a','#f13bdd','#10cdb2','#ff9d23']
export function randomAvatar(random=Math.random){
  const i=Math.floor(random()*COLORS.length),seed=Math.floor(random()*1000000)
  return {seed,outfit:random()<.5?'dress':'suit',color:COLORS[i],accent:COLORS[(i+3+Math.floor(random()*5))%COLORS.length],skin:['#ffd5b2','#efb388','#c78c68','#f4c5a3'][Math.floor(random()*4)],hair:['#3d243e','#6b3236','#2b2350','#bd3a86','#ffbd43'][Math.floor(random()*5)],hairStyle:Math.floor(random()*4),accessory:Math.floor(random()*4),pattern:Math.floor(random()*3)}
}
export function cleanNickname(input){return typeof input==='string'?[...input.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g,'').trim()].slice(0,12).join(''):''}
