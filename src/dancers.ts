import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Avatar, Action } from './party-types'
const sphere=new THREE.SphereGeometry(1,20,14),rounded=new RoundedBoxGeometry(1,1,1,3,.23)
const outline=new THREE.ShaderMaterial({uniforms:{thickness:{value:.009}},vertexShader:'uniform float thickness;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*thickness,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(.08,.035,.12,1.);}',side:THREE.BackSide})
const mats=new Map<string,THREE.MeshPhysicalMaterial>()
function material(color:string,shiny=false){const key=color+shiny;if(!mats.has(key))mats.set(key,new THREE.MeshPhysicalMaterial({color,roughness:shiny?.31:.58,metalness:shiny?.17:0,clearcoat:shiny?.7:.2,clearcoatRoughness:.4}));return mats.get(key)!}
function mesh(parent:THREE.Object3D,g:THREE.BufferGeometry,c:string,p:number[],s=[1,1,1],shiny=false,edge=false){const m=new THREE.Mesh(g,material(c,shiny));m.position.set(p[0]!,p[1]!,p[2]!);m.scale.set(s[0]!,s[1]!,s[2]!);m.castShadow=true;m.receiveShadow=true;parent.add(m);if(edge)m.add(new THREE.Mesh(g,outline));return m}
const ball=(p:THREE.Object3D,c:string,pos:number[],s:number[],shiny=false)=>mesh(p,sphere,c,pos,s,shiny)
const box=(p:THREE.Object3D,c:string,pos:number[],s:number[],shiny=false)=>mesh(p,rounded,c,pos,s,shiny,true)
function cylinder(p:THREE.Object3D,c:string,pos:number[],r:number,h:number,r2=r,shiny=false){return mesh(p,new THREE.CylinderGeometry(r,r2,h,16),c,pos,[1,1,1],shiny)}
export type Dancer = {root:THREE.Group;pose:THREE.Group;head:THREE.Group;arms:THREE.Group[];legs:THREE.Group[];eyes:THREE.Mesh[];ring:THREE.Mesh|null;avatar:Avatar;lie:number;dance:number;walk:number}
export function createDancer(avatar:Avatar,self=false):Dancer{
  const root=new THREE.Group(),pose=new THREE.Group(),head=new THREE.Group(),arms:THREE.Group[]=[],legs:THREE.Group[]=[],eyes:THREE.Mesh[]=[]
  root.add(pose);pose.add(head);head.position.y=1.40
  // A large rounded face occupies approximately half of the character's height.
  box(head,avatar.skin,[0,0,0],[.97,.91,.84])
  for(const side of [-1,1]){
    ball(head,avatar.skin,[side*.48,-.02,0],[.10,.14,.09])
    ball(head,'#f38c9e',[side*.30,-.13,.397],[.09,.043,.018])
    const eye=ball(head,'#2b1936',[side*.17,.025,.429],[.052,.066,.026]);eyes.push(eye)
    ball(head,'#fff8f4',[side*.17-.012,.046,.452],[.015,.019,.009])
    const brow=box(head,avatar.hair,[side*.18,.14,.417],[.14,.025,.023]);brow.rotation.z=side*-.07
  }
  ball(head,avatar.skin,[0,-.065,.44],[.038,.035,.03])
  const smile=new THREE.CatmullRomCurve3([new THREE.Vector3(-.085,-.18,.425),new THREE.Vector3(0,-.216,.44),new THREE.Vector3(.085,-.18,.425)])
  mesh(head,new THREE.TubeGeometry(smile,12,.012,5,false),'#953d65',[0,0,0])
  const hairCap=mesh(head,new THREE.SphereGeometry(1,24,16,0,Math.PI*2,0,Math.PI*.53),avatar.hair,[0,.20,-.02],[.51,.30,.45])
  hairCap.rotation.x=-.10
  for(let i=0;i<3;i++){const bang=ball(head,avatar.hair,[-.25+i*.18,.26,.34],[.13,.15,.11]);bang.rotation.z=-.3}
  if(avatar.hairStyle===1){for(let i=0;i<9;i++){const a=i/8*Math.PI;ball(head,avatar.hair,[Math.cos(a)*.42,.24+Math.sin(a)*.19,-.03],[.17,.16,.20])}}
  if(avatar.hairStyle===2){box(head,avatar.hair,[0,-.05,-.27],[.91,.72,.37]);for(const side of [-1,1])ball(head,avatar.hair,[side*.43,-.04,-.02],[.12,.34,.29])}
  if(avatar.hairStyle===3){for(const side of [-1,1]){ball(head,avatar.hair,[side*.47,.30,-.08],[.22,.22,.22]);ball(head,avatar.accent,[side*.49,.31,.13],[.10,.08,.055],true)}}
  cylinder(pose,avatar.skin,[0,.98,0],.12,.15)
  box(pose,avatar.color,[0,.73,0],[.61,.49,.39],true)
  if(avatar.outfit==='suit'){
    box(pose,avatar.accent,[0,.74,.205],[.28,.43,.035],true)
    for(const side of [-1,1]){const lapel=box(pose,avatar.color,[side*.13,.84,.235],[.13,.27,.035],true);lapel.rotation.z=side*-.28}
    const tie=box(pose,'#fff094',[0,.78,.258],[.065,.20,.025],true);tie.rotation.z=.07
    for(const side of [-1,1])ball(pose,avatar.accent,[side*.06,.96,.24],[.07,.037,.027],true)
    box(pose,avatar.color,[0,.43,0],[.53,.20,.37],true)
    for(const y of [.60,.70])ball(pose,'#ffdf68',[.12,y,.25],[.018,.018,.012],true)
  }else{
    const skirt=cylinder(pose,avatar.color,[0,.43,0],.23,.50,.47,true);skirt.rotation.y=Math.PI/12
    cylinder(pose,avatar.accent,[0,.67,0],.30,.075,.30,true).scale.z=.71
    const bow=ball(pose,avatar.accent,[.24,.66,.25],[.15,.075,.045],true);bow.rotation.z=-.2
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;ball(pose,avatar.accent,[Math.cos(a)*.43,.23,Math.sin(a)*.43],[.035,.028,.035],true)}
    for(const side of [-1,1])ball(pose,avatar.accent,[side*.31,.84,0],[.15,.17,.17],true)
    cylinder(pose,'#ffe67c',[0,.99,0],.13,.028,.13,true)
  }
  if(avatar.pattern===1){for(const [x,y]of [[-.17,.78],[.15,.84],[-.12,.61],[.17,.62],[0,.89]])ball(pose,avatar.accent,[x!,y!,.212],[.028,.028,.012],true)}
  if(avatar.pattern===2){for(const x of [-.22,-.11,.11,.22])box(pose,avatar.accent,[x,.70,.209],[.018,.29,.01],true)}
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.32,.87,0);pose.add(arm);arms.push(arm)
    cylinder(arm,avatar.color,[0,-.11,0],.10,.24,.09,true)
    cylinder(arm,avatar.outfit==='suit'?avatar.color:avatar.skin,[0,-.28,0],.075,.15,.075,avatar.outfit==='suit')
    ball(arm,avatar.skin,[0,-.39,.01],[.095,.10,.095]);arm.rotation.z=side*.12
    const leg=new THREE.Group();leg.position.set(side*.17,.41,0);pose.add(leg);legs.push(leg)
    cylinder(leg,avatar.outfit==='suit'?avatar.color:avatar.skin,[0,-.15,0],.085,.30,.08,avatar.outfit==='suit')
    ball(leg,avatar.accent,[0,-.34,.07],[.12,.075,.19],true)
  }
  if(avatar.accessory===0){
    if(avatar.outfit==='suit'){cylinder(head,avatar.accent,[0,.48,0],.46,.035,.46,true);cylinder(head,avatar.accent,[0,.60,-.025],.30,.23,.34,true);cylinder(head,avatar.color,[0,.52,-.025],.34,.045,.34,true)}
    else{for(const side of [-1,1]){const bow=ball(head,avatar.accent,[side*.10,.48,.12],[.15,.09,.08],true);bow.rotation.z=side*.32}}
  }else if(avatar.accessory===1){
    for(const side of [-1,1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.065,.014,5,18),material('#ffe56b',true));ring.position.set(side*.49,-.15,.05);head.add(ring)}
  }else if(avatar.accessory===2){
    for(const side of [-1,1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.10,.014,5,20),material(avatar.accent,true));ring.position.set(side*.17,.025,.467);head.add(ring)}
    box(head,avatar.accent,[0,.025,.468],[.14,.014,.012],true)
  }
  let ring:THREE.Mesh|null=null
  if(self){ring=new THREE.Mesh(new THREE.RingGeometry(.47,.51,48),new THREE.MeshBasicMaterial({color:'#c4ff48',transparent:true,opacity:.9,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;root.add(ring)}
  return{root,pose,head,arms,legs,eyes,ring,avatar,lie:0,dance:0,walk:0}
}
export function animateDancer(d:Dancer,action:Action,moving:boolean,time:number,dt:number){
  const smoothing=1-Math.exp(-dt*10),b=time*(128/60)*Math.PI*2,phase=d.avatar.seed%17*.13
  d.lie+=(Number(action==='lie'&&!moving)-d.lie)*smoothing
  d.dance+=(Number(action==='dance'&&!moving)-d.dance)*smoothing
  d.walk+=(Number(moving)-d.walk)*smoothing
  const dance=d.dance,walk=d.walk,swing=Math.sin(b+phase),step=Math.sin(time*10)
  d.pose.position.y=Math.abs(Math.sin(b))*.07*dance+Math.abs(step)*.045*walk+d.lie*.42
  d.pose.rotation.z=swing*.11*dance+d.lie*Math.PI/2
  d.pose.rotation.x=Math.cos(b*.5)*.07*dance
  d.head.rotation.z=-swing*.07*dance;d.head.rotation.y=Math.sin(b*.5+phase)*.14*dance
  d.arms.forEach((arm,i)=>{const s=i===0?-1:1;arm.rotation.x=step*s*.7*walk+Math.cos(b+phase+s)*.35*dance;arm.rotation.z=s*(.12+(.65+Math.sin(b*.5+phase+s)*.45)*dance)+s*.17*d.lie})
  d.legs.forEach((leg,i)=>{const s=i===0?-1:1;leg.rotation.x=-step*s*.65*walk+Math.sin(b+phase)*s*.18*dance;leg.rotation.z=s*.04*dance})
  if(action==='wave'&&!moving){d.arms[1]!.rotation.z=-2.4+Math.sin(time*11)*.3;d.arms[1]!.rotation.x=-.15;d.head.rotation.z=-.08}
  d.eyes.forEach(eye=>{eye.scale.y=.066*(1-d.lie*.87)})
  if(d.ring)(d.ring.material as THREE.MeshBasicMaterial).opacity=.65+Math.sin(b)*.15
}
