import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Toy } from './claw-game'

export type ToyModel = THREE.Group & {userData:{closedMouth?:THREE.Group;openMouth?:THREE.Group;[key:string]:unknown}}
const outline = new THREE.ShaderMaterial({
  uniforms:{thickness:{value:.018}},
  vertexShader:'uniform float thickness; void main(){vec3 expanded = position + normal * thickness; gl_Position = projectionMatrix * modelViewMatrix * vec4(expanded, 1.0);}',
  fragmentShader:'void main(){gl_FragColor = vec4(0.055,0.045,0.045,1.0);}',
  side:THREE.BackSide,
})
const sphere = new THREE.SphereGeometry(1,24,16)
const unitBox = new RoundedBoxGeometry(1,1,1,3,.17)
const materials = new Map<string,THREE.MeshPhysicalMaterial>()
export function toyMaterial(color:string){
  if(!materials.has(color))materials.set(color,new THREE.MeshPhysicalMaterial({color,roughness:.56,metalness:0,clearcoat:.19,clearcoatRoughness:.48}))
  return materials.get(color)!
}
function piece(parent:THREE.Object3D,geometry:THREE.BufferGeometry,color:string,position:number[],scale:number[]=[1,1,1],border=true){
  const m=new THREE.Mesh(geometry,toyMaterial(color));m.position.set(position[0]!,position[1]!,position[2]!);m.scale.set(scale[0]!,scale[1]!,scale[2]!);m.castShadow=true;m.receiveShadow=true
  if(border){const edge=new THREE.Mesh(geometry,outline);edge.name='inverted-hull-outline';m.add(edge)}
  parent.add(m);return m
}
const ball=(p:THREE.Object3D,c:string,pos:number[],s:number[],border=true)=>piece(p,sphere,c,pos,s,border)
const box=(p:THREE.Object3D,c:string,pos:number[],s:number[],border=true)=>piece(p,unitBox,c,pos,s,border)
function cylinder(p:THREE.Object3D,c:string,pos:number[],radius:number,height:number){return piece(p,new THREE.CylinderGeometry(radius,radius*.92,height,16,1),c,pos)}
function tube(p:THREE.Object3D,points:THREE.Vector3[],radius:number,color:string){
  return piece(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),14,radius,6,false),color,[0,0,0],[1,1,1],false)
}
function face(p:ToyModel,headY:number,z:number,kind:'kid'|'animal',expression:number){
  const eyes=kind==='kid'?.18:.145
  for(const side of [-1,1]){
    ball(p,'#191715',[side*eyes,headY+.015,z],[.044,.052,.025],false)
    ball(p,'#e9a495',[side*(kind==='kid'?.31:.24),headY-.09,z-.025],[.065,.026,.015],false)
    if(kind==='kid'){
      const brow=box(p,'#191715',[side*.20,headY+.16,z-.01],[.26,.072,.05]);brow.rotation.z=side*-.09
    }
  }
  if(kind==='kid')ball(p,'#FFD9B3',[0,headY-.07,z+.015],[.035,.035,.026],false)
  else ball(p,'#49392f',[0,headY-.06,z+.015],[.042,.03,.022],false)
  const closed=new THREE.Group(),open=new THREE.Group();p.add(closed,open)
  tube(closed,[new THREE.Vector3(-.075,headY-.16,z),new THREE.Vector3(0,headY-.19,z+.005),new THREE.Vector3(.075,headY-.16,z)],.012,'#332726')
  ball(open,'#582d2a',[0,headY-.16,z+.004],[.07,.10,.023],false)
  ball(open,'#df8a87',[0,headY-.207,z+.023],[.045,.03,.012],false)
  open.visible=expression===1;closed.visible=!open.visible
  p.userData.closedMouth=closed;p.userData.openMouth=open
}
function kid(toy:Toy){
  const g=new THREE.Group() as ToyModel, skin='#FFD9B3',black='#1d1918'
  // Rounded-square head, separately modelled thick eyebrows and cheek volume.
  box(g,skin,[0,1.02,0],[.92,.78,.73])
  ball(g,skin,[-.29,.96,.11],[.24,.28,.30]);ball(g,skin,[.29,.96,.11],[.24,.28,.30])
  for(const side of [-1,1])ball(g,skin,[side*.47,1.03,.01],[.10,.14,.09])
  const cap=piece(g,new THREE.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.52),black,[0,1.19,-.025],[.48,.29,.38])
  cap.rotation.x=-.08
  for(const x of [-.22,-.04,.15]){
    const tuft=piece(g,new THREE.ConeGeometry(.085,.18,5),black,[x,1.48,-.06]);tuft.rotation.z=-.3
  }
  box(g,toy.color,[0,.53,0],[.61,.44,.41])
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.13,.025,6,24),toyMaterial('#FFD9B3'));collar.rotation.x=Math.PI/2;collar.position.y=.76;g.add(collar)
  box(g,toy.accent,[0,.29,0],[.56,.23,.39])
  tube(g,[new THREE.Vector3(0,.2,.205),new THREE.Vector3(0,.31,.209)],.01,'#a38a36')
  for(const side of [-1,1]){
    const sleeve=cylinder(g,toy.color,[side*.34,.62,0],.13,.25);sleeve.rotation.z=side*.52
    const arm=cylinder(g,skin,[side*.43,.47,.01],.087,.25);arm.rotation.z=side*-.25
    ball(g,skin,[side*.46,.36,.03],[.105,.11,.10])
    cylinder(g,skin,[side*.16,.15,0],.085,.22)
    cylinder(g,'#fbf4e5',[side*.16,.07,.015],.09,.095)
    ball(g,'#e8bd3c',[side*.16,.035,.08],[.13,.065,.19])
  }
  if(toy.id===4){
    for(const [x,y]of [[-.13,.60],[.12,.47],[.04,.65]])ball(g,'#f7e5a7',[x!,y!,.218],[.035,.035,.008],false)
  }
  face(g,1.04,.406,'kid',toy.id===12?1:0)
  return g
}
function animal(toy:Toy){
  const g=new THREE.Group() as ToyModel,c=toy.color,a=toy.accent
  const isBunny=toy.kind==='bunny',isChick=toy.kind==='chick',isDog=toy.kind==='dog',isDino=toy.kind==='dino'
  ball(g,c,[0,.48,0],[.34,.40,.29]);ball(g,a,[0,.48,.24],[.23,.28,.08])
  const headY=isBunny?.99:1.02
  ball(g,c,[0,headY,0],[.43,.40,.35])
  for(const side of [-1,1]){
    ball(g,c,[side*.32,.52,.01],[.15,.23,.16]);ball(g,c,[side*.20,.10,.12],[.18,.12,.23])
    if(isBunny){const ear=ball(g,c,[side*.23,1.49,-.02],[.12,.36,.115]);ear.rotation.z=side*-.12;const inner=ball(g,a,[side*.23,1.49,.074],[.058,.25,.027],false);inner.rotation.z=side*-.12}
    else if(isDog){const ear=ball(g,c,[side*.40,1.04,-.02],[.16,.31,.16]);ear.rotation.z=side*.13}
    else if(!isChick&&!isDino){ball(g,c,[side*.32,1.32,-.035],[.18,.18,.13]);ball(g,a,[side*.32,1.33,.082],[.10,.10,.022],false)}
  }
  if(isDino){
    for(let i=0;i<4;i++){const spike=piece(g,new THREE.ConeGeometry(.11,.18,5),a,[0,1.43-i*.20,-.12-i*.1]);spike.rotation.x=-i*.35}
    const tail=piece(g,new THREE.ConeGeometry(.17,.58,12),c,[0,.30,-.41]);tail.rotation.x=-1.02
    for(const s of [-1,1])ball(g,a,[s*.22,1.05,.28],[.07,.08,.025],false)
  }
  if(isChick){
    for(const x of [-.1,0,.1]){const feather=ball(g,'#e8a648',[x,1.43,0],[.055,.14,.07]);feather.rotation.z=-x*2}
    piece(g,new THREE.ConeGeometry(.10,.16,4),'#e59743',[0,1.0,.37]).rotation.x=Math.PI/2
    for(const side of [-1,1]){ball(g,'#e79a4c',[side*.19,.055,.21],[.15,.065,.18]);ball(g,'#28221b',[side*.15,1.10,.32],[.042,.05,.02],false)}
  }else{
    if(isDog)ball(g,'#fbf5e9',[0,.92,.27],[.26,.17,.17])
    face(g,1.04,isDog?.43:.34,'animal',0)
  }
  if(toy.kind==='bear'||isDog){
    const band=cylinder(g,a,[0,.76,0],.26,.09);band.scale.z=.83
    if(!isDog){const bow=box(g,a,[0,.76,.26],[.24,.11,.05]);bow.rotation.z=.12}
  }
  if(!isDino)ball(g,c,[0,.32,-.27],[.13,.14,.14])
  return g
}
export function createToyModel(toy:Toy):ToyModel {
  const model=toy.kind==='kid'?kid(toy):animal(toy)
  model.scale.setScalar(toy.scale);model.name=toy.name;return model
}
