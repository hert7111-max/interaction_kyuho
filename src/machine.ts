import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { PIT_Y,TOP_Y,EXIT } from './claw-game.ts'

export type Machine = {group:THREE.Group;canopy:THREE.Group;claw:THREE.Group;fingers:THREE.Group[];cable:THREE.Mesh;bridge:THREE.Group;trolley:THREE.Group;target:THREE.Group;joystick:THREE.Group;button:THREE.Mesh;lamp:THREE.Mesh;prizeLight:THREE.PointLight}
const pink=new THREE.MeshPhysicalMaterial({color:'#d65b64',roughness:.29,metalness:.3,clearcoat:.8,clearcoatRoughness:.22})
const trim=new THREE.MeshPhysicalMaterial({color:'#f1baad',roughness:.3,metalness:.25,clearcoat:.6})
const cream=new THREE.MeshStandardMaterial({color:'#faf1d9',roughness:.48,metalness:.12})
const metal=new THREE.MeshStandardMaterial({color:'#bfc4c0',roughness:.22,metalness:.92})
const dark=new THREE.MeshStandardMaterial({color:'#383535',roughness:.35,metalness:.5})
const black=new THREE.MeshStandardMaterial({color:'#242725',roughness:.65})
const warmLED=new THREE.MeshBasicMaterial({color:'#fff4d0'})
const glass=new THREE.MeshPhysicalMaterial({color:'#e6f4ef',metalness:.04,roughness:.08,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide,clearcoat:1,envMapIntensity:1.2})
function block(parent:THREE.Object3D,size:number[],pos:number[],mat:THREE.Material,r=.06){
  const g=r?new RoundedBoxGeometry(size[0]!,size[1]!,size[2]!,3,r):new THREE.BoxGeometry(size[0]!,size[1]!,size[2]!)
  const mesh=new THREE.Mesh(g,mat);mesh.position.set(pos[0]!,pos[1]!,pos[2]!);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh
}
function rod(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material){
  const delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),20),mat)
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.castShadow=true;parent.add(mesh);return mesh
}
function labelTexture(text:string,sub:string,bg:string,fg:string,w=1024,h=256){
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')!
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${h*.43}px Arial`;ctx.fillText(text,w/2,h*.42)
  if(sub){ctx.font=`500 ${h*.105}px Arial`;ctx.letterSpacing='5px';ctx.fillText(sub,w/2,h*.82)}
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture
}
function sign(parent:THREE.Object3D,text:string,sub:string,w:number,h:number,pos:number[],bg='#f8eccb',fg='#b5434e'){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:labelTexture(text,sub,bg,fg),roughness:.55,metalness:0}));mesh.position.set(pos[0]!,pos[1]!,pos[2]!);parent.add(mesh);return mesh
}
function screw(parent:THREE.Object3D,x:number,y:number,z:number){
  const head=new THREE.Mesh(new THREE.CylinderGeometry(.038,.038,.016,12),metal);head.rotation.x=Math.PI/2;head.position.set(x,y,z);parent.add(head)
  block(parent,[.045,.007,.005],[x,y,z+.011],dark,0)
}
export function createMachine():Machine {
  const group=new THREE.Group();group.name='TOY CLUB claw machine'
  // Feet, rounded cabinet and front panels leave a real opening for the prize chute.
  for(const x of [-2.17,2.17])for(const z of [-1.75,1.75]){
    block(group,[.42,.22,.46],[x,.16,z],dark,.09);block(group,[.30,.22,.30],[x,.35,z],metal,.025)
  }
  block(group,[5.15,.25,4.35],[0,.43,0],pink,.09)
  block(group,[.23,2.15,4.25],[-2.46,1.57,0],pink);block(group,[.23,2.15,4.25],[2.46,1.57,0],pink)
  block(group,[4.85,2.15,.18],[0,1.57,-2.07],pink)
  block(group,[5.05,.38,.22],[0,.66,2.07],pink)
  block(group,[5.05,.69,.22],[0,2.30,2.07],pink)
  block(group,[.30,1.14,.22],[-2.36,1.39,2.07],pink)
  block(group,[3.39,1.14,.22],[.85,1.39,2.07],pink)
  block(group,[1.35,1.2,.1],[EXIT.x,1.38,1.83],black,.04)
  block(group,[1.40,.08,1.2],[EXIT.x,.78,2.5],metal,.02)
  block(group,[1.49,.08,.14],[EXIT.x,.79,3.1],trim,.025)
  block(group,[.08,1.05,.14],[-2.28,1.36,2.22],trim,.02);block(group,[.08,1.05,.14],[-.93,1.36,2.22],trim,.02)
  block(group,[1.43,.10,.14],[EXIT.x,1.86,2.22],trim,.02)
  sign(group,'PRIZE OUT','YOUR LITTLE HAPPINESS',1.16,.28,[EXIT.x,2.22,2.191],'#d65b64','#fff2dc')
  sign(group,'GOOD LUCK!','EVERY TRY IS A LITTLE ADVENTURE',2.4,.60,[.72,1.36,2.195],'#d65b64','#ffe9c7')
  block(group,[.40,.69,.08],[1.94,1.42,2.2],metal,.035);block(group,[.23,.07,.025],[1.94,1.61,2.25],black,.01)
  sign(group,'FREE','PLAY',.27,.26,[1.94,1.30,2.25],'#dadcd1','#484f46')
  for(const x of [-2.3,2.3])for(const y of [.7,2.3])screw(group,x,y,2.2)
  // Split floor: the front-left rectangle is open to the collection chute.
  const floorMat=new THREE.MeshStandardMaterial({color:'#f6d4b3',roughness:.85})
  block(group,[4.73,.13,2.84],[0,PIT_Y-.065,-.57],floorMat,.02)
  block(group,[3.52,.13,1.22],[.60,PIT_Y-.065,1.46],floorMat,.02)
  block(group,[.08,.36,1.28],[-1.03,PIT_Y+.14,1.36],cream,.025)
  block(group,[1.25,.36,.08],[-1.66,PIT_Y+.14,.75],cream,.025)
  sign(group,'DROP HERE','',1.06,.22,[-1.65,PIT_Y+.15,.80],'#faf1d9','#ac514d')
  // Sloping inner ramp is visible through the opening.
  const ramp=block(group,[1.13,.06,2.15],[-1.65,1.70,1.53],metal,.01);ramp.rotation.x=1.03
  block(group,[.06,1.75,1.45],[-2.25,1.70,1.35],cream,.01);block(group,[.06,1.75,1.45],[-1.05,1.70,1.35],cream,.01)
  // Console, physical joystick and illuminated drop button.
  const consolePanel=block(group,[5.12,.30,.77],[0,2.66,2.22],pink,.10);consolePanel.rotation.x=.16
  const consoleTop=block(group,[4.65,.055,.62],[0,2.85,2.18],cream,.06);consoleTop.rotation.x=.16
  const joystick=new THREE.Group();joystick.position.set(-1.15,2.90,2.25);group.add(joystick)
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.21,.25,.09,24),dark);joystick.add(base)
  rod(joystick,new THREE.Vector3(0,0,0),new THREE.Vector3(0,.34,0),.045,metal)
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.14,24,16),pink);knob.position.y=.36;knob.castShadow=true;joystick.add(knob)
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.06,32),metal);ring.position.set(1.2,2.93,2.22);group.add(ring)
  const button=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.10,32),new THREE.MeshPhysicalMaterial({color:'#e95f54',emissive:'#d64422',emissiveIntensity:.3,roughness:.25,clearcoat:1}));button.position.set(1.2,2.99,2.22);button.castShadow=true;group.add(button)
  // Corner posts, glazing and solid backboard.
  block(group,[4.75,4.14,.10],[0,4.89,-2.03],new THREE.MeshStandardMaterial({color:'#efc6b6',roughness:.6}),.01)
  sign(group,'PLAY. GRAB. LOVE.','A LITTLE JOY GOES A LONG WAY',3.6,.57,[0,5.40,-1.967],'#efc6b6','#d58e86')
  for(const x of [-2.42,2.42])for(const z of [-2.01,2.01]){
    block(group,[.16,4.34,.16],[x,4.98,z],trim,.035)
    block(group,[.045,3.77,.045],[x+(x>0?-.10:.10),4.89,z+(z>0?-.10:.10)],warmLED,.01)
  }
  for(const x of [-2.42,2.42]){
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(4.04,4.12),glass);pane.rotation.y=Math.PI/2;pane.position.set(x,4.99,0);pane.renderOrder=5;group.add(pane)
  }
  const frontGlass=new THREE.Mesh(new THREE.PlaneGeometry(4.70,4.12),glass);frontGlass.position.set(0,4.99,2.015);frontGlass.renderOrder=6;group.add(frontGlass)
  // Thin reflection streaks sell the front glass without hiding the toys.
  const glint=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide})
  for(const [x,w]of [[-1.85,.12],[-1.58,.04],[1.82,.06]]){
    const strip=new THREE.Mesh(new THREE.PlaneGeometry(w!,3.60),glint);strip.position.set(x!,4.98,2.03);strip.rotation.z=-.18;strip.renderOrder=7;group.add(strip)
  }
  // The canopy can be hidden for a useful top-down aiming view.
  const canopy=new THREE.Group();group.add(canopy)
  // Header marquee, dimensional lettering texture and roof.
  block(canopy,[5.28,.86,4.48],[0,7.47,0],pink,.12)
  block(canopy,[4.76,.63,.10],[0,7.47,2.27],cream,.11)
  sign(canopy,'TOY CLUB','CATCH A LITTLE HAPPINESS',4.21,.52,[0,7.48,2.331])
  block(canopy,[5.12,.10,4.31],[0,7.96,0],trim,.04)
  for(const x of [-2.36,2.36]){
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.06,12,8),warmLED);bulb.position.set(x,7.47,2.30);canopy.add(bulb)
  }
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.08,16,10),new THREE.MeshStandardMaterial({color:'#8bc298',emissive:'#73be90',emissiveIntensity:1.2}));lamp.position.set(2.08,7.76,2.32);canopy.add(lamp)
  // Two fixed rails, moving crossbeam, trolley and telescoping cable.
  for(const x of [-2.04,2.04])rod(group,new THREE.Vector3(x,6.98,-1.82),new THREE.Vector3(x,6.98,1.82),.055,metal)
  const bridge=new THREE.Group();bridge.position.y=6.98;group.add(bridge)
  block(bridge,[4.22,.12,.16],[0,0,0],metal,.025)
  for(const x of [-2.04,2.04])block(bridge,[.24,.22,.34],[x,0,0],dark,.04)
  const trolley=new THREE.Group();trolley.position.y=6.89;group.add(trolley)
  block(trolley,[.48,.27,.42],[0,0,0],cream,.06)
  const cable=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,1,12),dark);cable.position.y=(6.82+TOP_Y+.25)/2;cable.scale.y=6.82-TOP_Y-.25;group.add(cable)
  const claw=new THREE.Group();claw.position.y=TOP_Y;group.add(claw)
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.24,.18,.28,24),metal);claw.add(hub);hub.castShadow=true
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.24,24,16,0,Math.PI*2,0,Math.PI/2),cream);cap.position.y=.13;claw.add(cap)
  const fingers:THREE.Group[]=[]
  for(let i=0;i<3;i++){
    const radial=new THREE.Group();radial.rotation.y=i*Math.PI*2/3;claw.add(radial)
    const hinge=new THREE.Group();hinge.position.set(.17,-.09,0);radial.add(hinge);fingers.push(hinge)
    const joint=new THREE.Mesh(new THREE.SphereGeometry(.075,16,10),metal);hinge.add(joint)
    // One rigid curved finger rotates at its hinge as the claw closes.
    const points=[new THREE.Vector3(0,0,0),new THREE.Vector3(.18,-.23,0),new THREE.Vector3(.22,-.49,0),new THREE.Vector3(.10,-.72,0),new THREE.Vector3(-.04,-.79,0)]
    const finger=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,.047,10,false),metal);finger.castShadow=true;hinge.add(finger)
    const tip=new THREE.Mesh(new THREE.SphereGeometry(.057,12,10),dark);tip.position.copy(points[4]!);hinge.add(tip)
    rod(claw,new THREE.Vector3(0,.03,0),new THREE.Vector3(Math.cos(i*Math.PI*2/3)*.18,-.16,-Math.sin(i*Math.PI*2/3)*.18),.022,metal)
  }
  // Ring and crosshair project the claw's position onto the toy bed.
  const target=new THREE.Group();target.position.y=PIT_Y+.012;group.add(target)
  const targetMat=new THREE.MeshBasicMaterial({color:'#c94b52',transparent:true,opacity:.65,depthWrite:false})
  const circle=new THREE.Mesh(new THREE.RingGeometry(.31,.325,48),targetMat);circle.rotation.x=-Math.PI/2;target.add(circle)
  for(const angle of [0,Math.PI/2]){const cross=new THREE.Mesh(new THREE.PlaneGeometry(.13,.014),targetMat);cross.rotation.x=-Math.PI/2;cross.rotation.z=angle;target.add(cross)}
  const prizeLight=new THREE.PointLight('#ffde99',0,2.4);prizeLight.position.set(EXIT.x,1.35,2.7);group.add(prizeLight)
  return {group,canopy,claw,fingers,cable,bridge,trolley,target,joystick,button,lamp,prizeLight}
}
