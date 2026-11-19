import * as THREE from 'three'
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js'
import {writeFile} from 'node:fs/promises'
// Offline anatomical volume: wrist, palm, thenar web, thumb and four curled fingers are fused before triangulation.
const bounds=[.23,-1.74,-.40,1.37,.56,.66],resolution=100
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)}
const union=(a,b,k)=>{const h=clamp(.5+.5*(b-a)/k);return b*(1-h)+a*h-k*h*(1-h)}
function ellipsoid(x,y,z,c,r){const a=(x-c[0])/r[0],b=(y-c[1])/r[1],d=(z-c[2])/r[2],k0=Math.hypot(a,b,d),k1=Math.hypot(a/r[0],b/r[1],d/r[2]);return k0<.000001?-Math.min(...r):k0*(k0-1)/k1}
function segment(x,y,z,a,b,r0,r1){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],t=clamp(((x-a[0])*dx+(y-a[1])*dy+(z-a[2])*dz)/(dx*dx+dy*dy+dz*dz));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t,z-a[2]-dz*t)-(r0+(r1-r0)*t)}
const chains=[
 [[.84,-.34,.18,.115],[.75,-.20,.265,.095],[.64,-.055,.286,.079],[.565,.13,.262,.064]],
 [[.88,-.015,.065,.073],[.85,.18,-.02,.060],[.69,.355,-.105,.053],[.565,.375,-.035,.048]],
 [[.91,-.12,.07,.070],[.965,-.155,-.115,.060],[.765,-.255,-.208,.055],[.635,-.19,-.13,.048]],
 [[.915,-.25,.065,.065],[.955,-.28,-.13,.055],[.765,-.37,-.19,.050],[.66,-.315,-.12,.045]],
 [[.88,-.365,.075,.058],[.905,-.415,-.095,.050],[.76,-.475,-.15,.044],[.70,-.42,-.08,.040]]
]
function chainDistance(x,y,z,chain){let d=1e5;for(let i=0;i<chain.length-1;i++)d=union(d,segment(x,y,z,chain[i],chain[i+1],chain[i][3],chain[i+1][3]),.027);return d}
function palmDistance(x,y,z){let d=ellipsoid(x,y,z,[.87,-.245,.14],[.185,.295,.100]);d=union(d,ellipsoid(x,y,z,[.755,-.245,.215],[.115,.18,.09]),.055);d=union(d,ellipsoid(x,y,z,[.885,-.04,.105],[.15,.14,.087]),.045);d=union(d,segment(x,y,z,[.87,-.46,.14],[.99,-.88,.26],.108,.14),.055);return union(d,segment(x,y,z,[.99,-.88,.26],[1.12,-1.39,.39],.14,.175),.045)}
function volume(x,y,z){let d=palmDistance(x,y,z);for(let i=0;i<chains.length;i++)d=union(d,chainDistance(x,y,z,chains[i]),i===0?.047:.026);return d}
const effect=new MarchingCubes(resolution,new THREE.MeshBasicMaterial(),false,false,180000);effect.isolation=0
const span=[bounds[3]-bounds[0],bounds[4]-bounds[1],bounds[5]-bounds[2]]
for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
 const px=bounds[0]+x/resolution*span[0],py=bounds[1]+y/resolution*span[1],pz=bounds[2]+z/resolution*span[2];const d=volume(px,py,pz)
 effect.field[(z*resolution+y)*resolution+x]=-d
}
effect.update()
const positions=[],indices=[],lookup=new Map(),raw=effect.geometry.getAttribute('position')
for(let i=0;i<effect.count;i+=3){const tri=[];for(let j=0;j<3;j++){
 const n=i+j,x=Math.round(clamp((raw.getX(n)+1)*.5)*65535),y=Math.round(clamp((raw.getY(n)+1)*.5)*65535),z=Math.round(clamp((raw.getZ(n)+1)*.5)*65535),key=`${x},${y},${z}`
 let id=lookup.get(key);if(id===undefined){id=positions.length/3;lookup.set(key,id);positions.push(x,y,z)}tri.push(id)
 }if(new Set(tri).size===3)indices.push(...tri)
}
if(positions.length/3>65535)throw new Error('Hand exceeds 16-bit index budget')
const joints=[],weights=[],normals=[]
for(let i=0;i<positions.length;i+=3){
 const x=bounds[0]+positions[i]/65535*span[0],y=bounds[1]+positions[i+1]/65535*span[1],z=bounds[2]+positions[i+2]/65535*span[2],palm=palmDistance(x,y,z)
 let best=Infinity,joint=0,weight=0
 for(let j=0;j<chains.length;j++){
  const chain=chains[j],d=chainDistance(x,y,z,chain)
  if(d<best){best=d;joint=j+1;const first=chain[0],last=chain[3],dx=last[0]-first[0],dy=last[1]-first[1],dz=last[2]-first[2],t=clamp(((x-first[0])*dx+(y-first[1])*dy+(z-first[2])*dz)/(dx*dx+dy*dy+dz*dz));weight=smooth(j===0?.04:.06,j===0?.64:.7,t)*smooth(-.055,.025,palm-d)}
 }
 joints.push(joint);weights.push(Math.round(weight*65535))
 const e=.0008,nx=volume(x+e,y,z)-volume(x-e,y,z),ny=volume(x,y+e,z)-volume(x,y-e,z),nz=volume(x,y,z+e)-volume(x,y,z-e),n=Math.hypot(nx,ny,nz)||1
 normals.push(Math.round(nx/n*32767),Math.round(ny/n*32767),Math.round(nz/n*32767))
}
const b64=a=>Buffer.from(a.buffer).toString('base64')
const data={version:1,bounds,vertices:positions.length/3,triangles:indices.length/3,positions:b64(new Uint16Array(positions)),indices:b64(new Uint16Array(indices)),normals:b64(new Int16Array(normals)),joints:b64(new Uint8Array(joints)),weights:b64(new Uint16Array(weights))}
await writeFile(new URL('../src/arcade-hand-mesh.ts',import.meta.url),'// Generated offline by scripts/build-arcade-hands.mjs. One closed, connected skin surface.\nexport default '+JSON.stringify(data)+'\n')
console.log(`Unified hand baked: ${data.vertices} vertices, ${data.triangles} triangles, ${(JSON.stringify(data).length/1024).toFixed(0)} KiB source.`)
effect.geometry.dispose();effect.material.dispose()
