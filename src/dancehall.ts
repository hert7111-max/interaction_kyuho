import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { COLUMNS } from '../shared/world.mjs'
const colors=['#ff40bf','#29e9ff','#b86bff','#ffcd31','#7bff50','#ff6464']
const material=(color:string,roughness=.5,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})
const glowMaterial=(color:string)=>new THREE.MeshBasicMaterial({color,toneMapped:false})
function box(g:THREE.Object3D,s:number[],p:number[],m:THREE.Material,r=.06){const o=new THREE.Mesh(r?new RoundedBoxGeometry(s[0]!,s[1]!,s[2]!,2,r):new THREE.BoxGeometry(s[0]!,s[1]!,s[2]!),m);o.position.set(p[0]!,p[1]!,p[2]!);o.receiveShadow=true;o.castShadow=true;g.add(o);return o}
function woodTexture(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const ctx=canvas.getContext('2d')!
  let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
  ctx.fillStyle='#a87951';ctx.fillRect(0,0,1024,1024)
  for(let row=0;row<16;row++){const y=row*64;for(let col=-1;col<5;col++){const x=col*256+(row%2)*128;const light=34+random()*11;ctx.fillStyle=`hsl(${24+random()*8} 39% ${light}%)`;ctx.fillRect(x,y,255,63);for(let i=0;i<21;i++){ctx.strokeStyle=`rgba(56,24,8,${.03+random()*.09})`;ctx.lineWidth=.5+random();ctx.beginPath();const lineY=y+random()*62;ctx.moveTo(x,lineY);ctx.bezierCurveTo(x+85,lineY+random()*7,x+180,lineY-random()*5,x+256,lineY);ctx.stroke()}}}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3.5,3);return texture
}
function textSign(text:string,sub:string,color:string,width:number,height:number){
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=512;const ctx=canvas.getContext('2d')!
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=color;ctx.shadowBlur=35;ctx.font='900 240px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';ctx.fillStyle=color;ctx.fillText(text,768,213);ctx.shadowBlur=12;ctx.strokeStyle='#fff5bc';ctx.lineWidth=2;ctx.strokeText(text,768,213)
  ctx.shadowBlur=10;ctx.fillStyle='#ffeeb5';ctx.font='500 41px "Noto Sans KR", sans-serif';ctx.fillText(sub,768,420)
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false}))
}
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!,gradient=ctx.createRadialGradient(64,64,1,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.28,'rgba(255,255,255,.7)');gradient.addColorStop(.65,'rgba(255,255,255,.12)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)}
export function createDancehall(scene:THREE.Scene){
  const room=new THREE.Group();scene.add(room)
  const wood=woodTexture();const floor=new THREE.Mesh(new THREE.PlaneGeometry(22,19),new THREE.MeshStandardMaterial({map:wood,roughness:.28,metalness:.22}));floor.rotation.x=-Math.PI/2;floor.position.z=-.4;floor.receiveShadow=true;room.add(floor)
  const purple=material('#442044',.8),pink=material('#9e245d',.55),gold=material('#e0a444',.3,.7),mirror=new THREE.MeshStandardMaterial({color:'#c8d5ec',roughness:.065,metalness:.95,envMapIntensity:1.7})
  box(room,[22,6.8,.22],[0,3.4,-9],purple)
  for(const side of [-1,1]){
    box(room,[.22,4.5,18],[side*11,2.25,0],purple)
    box(room,[.08,.12,18],[side*10.85,4.45,0],glowMaterial('#fc4dca'))
    box(room,[.12,.18,18],[side*10.85,.12,0],gold)
    for(const z of [-6.4,-2.2,2,6.2]){
      box(room,[.08,2.8,3.3],[side*10.84,2.6,z],mirror,.01)
      for(const edge of [-1,1])box(room,[.10,2.94,.07],[side*10.76,2.6,z+edge*1.68],gold,.01)
      box(room,[.10,.07,3.43],[side*10.76,4.05,z],gold,.01)
    }
    for(const z of [-2.8,2.5,6.3]){
      box(room,[1.02,.48,2.9],[side*10.1,.35,z],material(side===1?'#ca3c89':'#7844b7',.85),.16)
      box(room,[.22,.87,2.9],[side*10.49,.87,z],pink,.14)
      for(let i=0;i<4;i++)box(room,[.78,.04,.035],[side*10.05,.61,z-1.1+i*.73],gold,.01)
    }
  }
  box(room,[21.6,.12,.12],[0,6.3,-8.8],glowMaterial('#ffc31d'))
  box(room,[21.6,.07,.12],[0,5.92,-8.8],glowMaterial('#ff5ecb'))
  for(let i=0;i<35;i++){
    const curtain=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,4.4,12),material(i%2?'#8e1d58':'#bc2a68',.91));curtain.position.set(-10.2+i*.60,2.4,-8.70);room.add(curtain)
  }
  box(room,[13,.38,3.1],[0,.19,-7.35],material('#432658',.5),.10)
  box(room,[13.1,.07,.08],[0,.39,-5.80],glowMaterial('#ffd93c'),.01)
  for(let i=0;i<27;i++)box(room,[.055,.10,.08],[-6.25+i*.48,.18,-5.76],glowMaterial(colors[i%colors.length]!),.01)
  const sign=textSign('콜라텍','청춘은 지금부터 · EVERYBODY DANCE','#ff55ce',8.4,2.8);sign.position.set(0,4.25,-8.31);room.add(sign)
  for(const side of [-1,1]){
    const placard=textSign(side===1?'신나게':'화려하게','오늘도 꽃처럼',side===1?'#55f3dd':'#ffd144',2.8,1.2);placard.position.set(side*8.1,4.2,-8.30);room.add(placard)
    const speaker=box(room,[1.1,2.2,.8],[side*6.7,1.43,-7.8],material('#23162f',.65),.1)
    for(const y of [-.55,.4]){const cone=new THREE.Mesh(new THREE.CylinderGeometry(y<0?.37:.25,y<0?.37:.25,.08,32),material('#342c48',.7));cone.rotation.x=Math.PI/2;cone.position.set(0,y,.46);speaker.add(cone);const rim=new THREE.Mesh(new THREE.TorusGeometry(y<0?.39:.27,.023,6,28),gold);rim.position.set(0,y,.51);speaker.add(rim)}
  }
  const booth=box(room,[2.7,.95,.8],[0,.87,-7.1],material('#802e8f',.35,.25),.13)
  box(booth,[2.4,.57,.04],[0,0,.43],material('#281434'),.03)
  const eq:THREE.Mesh[]=[]
  for(let i=0;i<16;i++){const bar=box(booth,[.075,.4,.025],[-1.07+i*.14,0,.47],glowMaterial(colors[i%6]!),.015);eq.push(bar)}
  const djSign=textSign('DJ','콜라텍 주민', '#ffe275',1.0,.5);djSign.position.set(0,1.65,-7.2);room.add(djSign)
  for(const {x,z}of COLUMNS){
    box(room,[.85,5.7,.85],[x,2.85,z],mirror,.035)
    box(room,[1.02,.23,1.02],[x,.15,z],gold,.05)
    box(room,[1.02,.23,1.02],[x,5.6,z],gold,.05)
    for(const side of [-1,1]){box(room,[.025,5.4,.035],[x+side*.43,2.85,z+.44],glowMaterial('#f647e4'),.005);box(room,[.035,5.4,.025],[x+.44,2.85,z+side*.43],glowMaterial('#27eadc'),.005)}
  }
  const balls:THREE.Group[]=[]
  function discoBall(x:number,y:number,z:number,scale:number){
    const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);room.add(group);balls.push(group)
    const core=new THREE.Mesh(new THREE.SphereGeometry(.67,32,24),mirror);group.add(core)
    const count=18*36,tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(.103,.105,.018),mirror,count),dummy=new THREE.Object3D()
    let index=0
    for(let row=0;row<18;row++)for(let col=0;col<36;col++){const phi=(row+.5)/18*Math.PI,theta=col/36*Math.PI*2,direction=new THREE.Vector3(Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta));dummy.position.copy(direction).multiplyScalar(.684);dummy.lookAt(direction.multiplyScalar(2));dummy.scale.set(Math.max(.14,Math.sin(phi)),1,1);dummy.updateMatrix();tiles.setMatrixAt(index,dummy.matrix);tiles.setColorAt(index,new THREE.Color(index%9===0?colors[index%6]!:'#d8e6ff'));index++}
    group.add(tiles)
    const cord=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,7-y,8),material('#342638'));cord.position.set(x,y+(7-y)/2,z);room.add(cord)
  }
  discoBall(0,5.65,-.5,1.2);discoBall(-5,5.25,-5,.65);discoBall(5,5.25,-5,.65)
  // Festoon strings sweep across the open ceiling; instancing keeps the many bulbs cheap.
  const bulbsCount=19*45,bulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(.028,6,4),new THREE.MeshBasicMaterial({toneMapped:false}),bulbsCount),dummy=new THREE.Object3D();let bulbIndex=0
  for(let line=0;line<19;line++){
    const z=-8+line*.82,points:THREE.Vector3[]=[]
    for(let i=0;i<45;i++){const x=-10.6+i/44*21.2,y=6.4-Math.sin(i/44*Math.PI)*.6+Math.cos(line)*.1;points.push(new THREE.Vector3(x,y,z));dummy.position.set(x,y,z);dummy.scale.setScalar(i%4===0?1.4:1);dummy.updateMatrix();bulbs.setMatrixAt(bulbIndex,dummy.matrix);bulbs.setColorAt(bulbIndex,new THREE.Color(colors[(i+line*2)%6]!).multiplyScalar(1.5));bulbIndex++}
    const geo=new THREE.BufferGeometry().setFromPoints(points);room.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:'#716052',transparent:true,opacity:.42})))
  }
  room.add(bulbs)
  const glowMap=glowTexture(),spots=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:glowMap,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}),100);spots.frustumCulled=false;spots.renderOrder=2;room.add(spots)
  for(let i=0;i<100;i++)spots.setColorAt(i,new THREE.Color(colors[i%6]!).multiplyScalar(.85))
  const beams:{mesh:THREE.Mesh;origin:THREE.Vector3;phase:number}[]=[]
  for(let i=0;i<6;i++){
    const c=new THREE.Color(colors[i]!),beam=new THREE.Mesh(new THREE.CylinderGeometry(.025,1.65,1,24,1,true),new THREE.ShaderMaterial({uniforms:{tint:{value:c}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform vec3 tint;void main(){float edge=pow(sin(vUv.x*3.14159),2.);float a=(.018+.07*vUv.y)*edge;gl_FragColor=vec4(tint,a);}',transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));beam.renderOrder=3;room.add(beam);const origin=new THREE.Vector3(i%2?7.5:-7.5,6,-6+Math.floor(i/2)*4);beams.push({mesh:beam,origin,phase:i*1.5})
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),glowMaterial(colors[i]!));lamp.position.copy(origin);room.add(lamp)
  }
  const target=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0)
  return {group:room,update(time:number){
    balls.forEach((ball,i)=>ball.rotation.y=time*(.21+i*.05))
    eq.forEach((bar,i)=>{bar.scale.y=.2+Math.abs(Math.sin(time*4+i*.7))*.8})
    for(let i=0;i<100;i++){const a=i*2.39996+time*.045,r=2+Math.sqrt(i/100)*10;dummy.position.set(Math.sin(a)*r,.028,Math.cos(a)*r*.72-.5);dummy.rotation.set(-Math.PI/2,0,time*.12+i);const s=.38+(i%5)*.10;dummy.scale.set(s*(1+Math.sin(time+i)*.15),s,1);dummy.updateMatrix();spots.setMatrixAt(i,dummy.matrix)}spots.instanceMatrix.needsUpdate=true
    for(const beam of beams){target.set(Math.sin(time*.19+beam.phase)*6,.04,Math.cos(time*.15+beam.phase)*4);direction.copy(beam.origin).sub(target);beam.mesh.position.copy(beam.origin).add(target).multiplyScalar(.5);beam.mesh.scale.y=direction.length();beam.mesh.quaternion.setFromUnitVectors(up,direction.normalize())}
  }}
}
