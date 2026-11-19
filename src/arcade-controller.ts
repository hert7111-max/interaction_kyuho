import * as THREE from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import type {ArcadeGame,ArcadeHand} from './arcade-game'
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
function rounded(w:number,h:number,d:number,m:THREE.Material,x=0,y=0,z=0,r=.025){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),m);mesh.position.set(x,y,z);return mesh}
/** Reusable curved skin mesh. The last phalanx stays on the controller instead of floating above it. */
class Finger{
  readonly group=new THREE.Group()
  readonly points:THREE.Vector3[]
  private base:THREE.Vector3[]
  private curve:THREE.CatmullRomCurve3
  private geometry=new THREE.BufferGeometry()
  private position=new Float32Array(19*11*3)
  private normals=new Float32Array(this.position.length)
  private nail:THREE.Mesh|undefined
  private p=v(0,0,0)
  private tangent=v(0,1,0)
  private normal=v(1,0,0)
  private binormal=v(0,0,1)
  private up=v(0,0,1)
  constructor(points:THREE.Vector3[],privateRadius:number,skin:THREE.Material,nail?:THREE.Material){
    this.radius=privateRadius;this.base=points.map(p=>p.clone());this.points=points.map(p=>p.clone());this.curve=new THREE.CatmullRomCurve3(this.points)
    const indices:number[]=[];for(let j=0;j<18;j++)for(let i=0;i<10;i++){const a=j*11+i,b=a+11;indices.push(a,b,a+1,b,b+1,a+1)}
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.position,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setAttribute('normal',new THREE.BufferAttribute(this.normals,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setIndex(indices)
    const mesh=new THREE.Mesh(this.geometry,skin);mesh.frustumCulled=false;this.group.add(mesh)
    if(nail){this.nail=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),nail);this.nail.scale.set(privateRadius*.46,privateRadius*.58,.005);this.group.add(this.nail)}
    this.pose(0,0,0)
  }
  private last=[NaN,NaN,NaN,NaN]
  private radius:number
  pose(x:number,y:number,press:number,curl=0){
    if(Math.abs(x-this.last[0]!)<.00001&&Math.abs(y-this.last[1]!)<.00001&&Math.abs(press-this.last[2]!)<.00001&&Math.abs(curl-this.last[3]!)<.00001)return
    this.last[0]=x;this.last[1]=y;this.last[2]=press;this.last[3]=curl
    for(let i=0;i<4;i++){this.points[i]!.copy(this.base[i]!);if(i>0){this.points[i]!.x+=x*i/3;this.points[i]!.y+=y*i/3;this.points[i]!.z-=press*i/3+curl*.025*Math.sin(i/3*Math.PI)}}
    this.updateMesh()
  }
  private updateMesh(){
    for(let j=0;j<=18;j++){
      const t=j/18;this.curve.getPoint(t,this.p);this.curve.getTangent(t,this.tangent);this.normal.crossVectors(this.tangent,this.up).normalize();if(this.normal.lengthSq()<.01)this.normal.set(1,0,0);this.binormal.crossVectors(this.normal,this.tangent).normalize()
      const cap=t<.10?Math.sin(t/.10*Math.PI/2):t>.86?Math.cos((t-.86)/.14*Math.PI/2):1,r=this.radius*(1-t*.23)*cap
      for(let i=0;i<=10;i++){const angle=i/10*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),k=(j*11+i)*3,nx=this.normal.x*c+this.binormal.x*s,ny=this.normal.y*c+this.binormal.y*s,nz=this.normal.z*c+this.binormal.z*s;this.position[k]=this.p.x+nx*r;this.position[k+1]=this.p.y+ny*r;this.position[k+2]=this.p.z+nz*r;this.normals[k]=nx;this.normals[k+1]=ny;this.normals[k+2]=nz}
    }
    this.geometry.getAttribute('position').needsUpdate=true;this.geometry.getAttribute('normal').needsUpdate=true
    if(this.nail){this.curve.getPoint(.86,this.p);this.curve.getTangent(.86,this.tangent);this.nail.position.copy(this.p);this.nail.position.z+=this.radius*.68;this.nail.rotation.z=-Math.atan2(this.tangent.x,this.tangent.y)}
  }
}
function palm(side:number,material:THREE.Material){
  const rings=[[-.59,.095,.075],[-.46,.12,.082],[-.32,.165,.10],[-.17,.18,.112],[.0,.175,.10],[.13,.14,.082],[.18,.09,.06]],vertices:number[]=[],indices:number[]=[]
  const segments=16
  for(let j=0;j<rings.length;j++){const [y,w,d]=rings[j]!;for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;vertices.push(side*(.87+Math.cos(a)*w!),y!,.135+Math.sin(a)*d!)} }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;if(side>0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1)}
  for(const row of [0,rings.length-1]){const center=vertices.length/3;vertices.push(side*.87,rings[row]![0]!, .135);for(let i=0;i<segments;i++){const a=row*(segments+1)+i,b=a+1;if((row===0)===(side>0))indices.push(center,a,b);else indices.push(center,b,a)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);return mesh
}
function limb(a:THREE.Vector3,b:THREE.Vector3,r1:number,r2:number,material:THREE.Material){const delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,delta.length(),14,3),material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(v(0,1,0),delta.normalize());return mesh}
type Rig={thumb:Finger;fingers:Finger[];stick:THREE.Group;trigger:THREE.Mesh;buttons:THREE.Group[];thumbX:number;thumbY:number;curl:number[]}
export class ArcadeController{
  readonly group=new THREE.Group()
  readonly cablePort=new THREE.Object3D()
  private rigs:Rig[]=[]
  constructor(){
    const plastic=new THREE.MeshStandardMaterial({color:'#c5c3bc',roughness:.58}),rear=new THREE.MeshStandardMaterial({color:'#9a9b98',roughness:.66}),rubber=new THREE.MeshStandardMaterial({color:'#282b30',roughness:.91}),skin=new THREE.MeshStandardMaterial({color:'#c99e81',roughness:.78}),nail=new THREE.MeshStandardMaterial({color:'#cba68d',roughness:.4})
    const outline=new THREE.Shape();outline.moveTo(-.90,-.35);outline.bezierCurveTo(-.92,-.58,-.69,-.65,-.58,-.42);outline.lineTo(-.40,-.14);outline.quadraticCurveTo(0,-.19,.40,-.14);outline.lineTo(.58,-.42);outline.bezierCurveTo(.69,-.65,.92,-.58,.90,-.35);outline.lineTo(.80,.17);outline.bezierCurveTo(.76,.41,.49,.43,.30,.26);outline.quadraticCurveTo(0,.16,-.30,.26);outline.bezierCurveTo(-.49,.43,-.76,.41,-.80,.17);outline.closePath()
    const geo=new THREE.ExtrudeGeometry(outline,{depth:.18,bevelEnabled:true,bevelSize:.055,bevelThickness:.052,bevelSegments:3,curveSegments:10,steps:1});geo.translate(0,0,-.09);geo.computeVertexNormals();this.group.add(new THREE.Mesh(geo,plastic))
    for(const side of [-1,1]){
      const grip=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),rear);grip.scale.set(.19,.35,.16);grip.position.set(side*.68,-.27,-.06);grip.rotation.z=side*.35;this.group.add(grip)
      this.group.add(rounded(.31,.105,.16,rubber,side*.58,.36,-.035,.03))
      const trigger=rounded(.25,.075,.12,rear,side*.58,.405,-.10,.025);this.group.add(trigger)
      const stick=new THREE.Group();stick.position.set(side*.25,-.052,.16);this.group.add(stick)
      const rim=new THREE.Mesh(new THREE.CylinderGeometry(.14,.15,.05,20),rear);rim.rotation.x=Math.PI/2;stick.add(rim)
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.099,.108,.065,20),rubber);cap.rotation.x=Math.PI/2;cap.position.z=.052;stick.add(cap)
      const disc=new THREE.Mesh(new THREE.CircleGeometry(.081,20),new THREE.MeshStandardMaterial({color:'#36393c',roughness:1}));disc.position.z=.087;stick.add(disc)
      const buttons:THREE.Group[]=[]
      if(side<0){
        for(let i=0;i<4;i++){const angle=i*Math.PI/2,button=rounded(.068,.096,.05,rubber,-.55+Math.sin(angle)*.066,.145+Math.cos(angle)*.066,.177,.012);button.rotation.z=-angle;this.group.add(button)}
      }else{
        for(let i=0;i<4;i++){
          const button=new THREE.Group(),positions=[[.55,.275],[.67,.155],[.55,.035],[.43,.155]],p=positions[i]!;button.position.set(p[0]!,p[1]!, .17)
          const disc=new THREE.Mesh(new THREE.CylinderGeometry(.067,.070,.045,16),rubber);disc.rotation.x=Math.PI/2;button.add(disc)
          const colors=['#54ba9c','#d47683','#809dc4','#c48fba'],points=i===0?[[-.028,-.024],[0,.028],[.028,-.024],[-.028,-.024]]:i===1?Array.from({length:25},(_,j)=>[Math.cos(j/24*Math.PI*2)*.029,Math.sin(j/24*Math.PI*2)*.029]):i===2?[[-.024,-.024],[.024,.024],[0,0],[-.024,.024],[.024,-.024]]:[[-.025,-.025],[.025,-.025],[.025,.025],[-.025,.025],[-.025,-.025]]
          const line=new THREE.BufferGeometry().setFromPoints(points.map(p=>v(p[0]!,p[1]!, .024)));button.add(new THREE.Line(line,new THREE.LineBasicMaterial({color:colors[i]})));this.group.add(button);buttons.push(button)
        }
      }
      this.group.add(rounded(.078,.028,.022,rubber,side*.09,.13,.16,.007))
      const hand=new THREE.Group();this.group.add(hand);hand.add(palm(side,skin))
      const mound=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),skin);mound.scale.set(.125,.17,.105);mound.position.set(side*.77,-.15,.195);mound.rotation.z=-side*.35;hand.add(mound)
      hand.add(limb(v(side*.87,-.53,.135),v(side*1.10,-1.21,.50),.105,.18,skin))
      const cuff=rounded(.37,.15,.30,new THREE.MeshStandardMaterial({color:'#dfd9cd',roughness:.9}),side*1.04,-1.12,.35,.05);cuff.rotation.z=side*.25;hand.add(cuff)
      const thumbPoints=side<0?[v(-.78,-.19,.255),v(-.73,-.04,.285),v(-.60,.065,.28),v(-.55,.16,.262)]:[v(.78,-.19,.255),v(.80,-.04,.285),v(.71,.07,.28),v(.65,.16,.262)]
      const thumb=new Finger(thumbPoints,.075,skin,nail);hand.add(thumb.group)
      const paths=[[[.80,.07,-.02],[.77,.22,-.115],[.62,.385,-.10],[.58,.40,-.025]],[[.90,-.065,-.025],[.95,-.13,-.17],[.75,-.23,-.23],[.62,-.19,-.13]],[[.90,-.19,-.025],[.93,-.27,-.15],[.76,-.36,-.21],[.65,-.32,-.12]],[[.86,-.32,-.005],[.88,-.40,-.12],[.75,-.46,-.17],[.69,-.42,-.095]]]
      const fingers=paths.map((path,i)=>{const finger=new Finger(path.map(p=>v(p[0]!*side,p[1]!,p[2]!)),.059-i*.005,skin,i===0?nail:undefined);hand.add(finger.group);return finger})
      this.rigs.push({thumb,fingers,stick,trigger,buttons,thumbX:0,thumbY:0,curl:[.5,.5,.5,.5]})
    }
    const label=document.createElement('canvas');label.width=256;label.height=64;const c=label.getContext('2d')!;c.clearRect(0,0,256,64);c.fillStyle='#464a4e';c.font='bold 27px serif';c.textAlign='center';c.fillText('SONY',128,27);c.font='12px sans-serif';c.fillText('DUAL ANALOG',128,47)
    const texture=new THREE.CanvasTexture(label);const print=new THREE.Mesh(new THREE.PlaneGeometry(.34,.085),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));print.position.set(0,.222,.158);this.group.add(print)
    this.group.add(rounded(.055,.015,.012,new THREE.MeshBasicMaterial({color:'#cd3a42'}),0,.025,.158,.004))
    const plug=rounded(.11,.09,.16,rubber,0,.32,-.015,.018);this.group.add(plug);this.cablePort.position.set(0,.37,-.085);this.group.add(this.cablePort)
    this.group.position.set(0,-.47,-2.65);this.group.rotation.x=-.37
  }
  update(game:ArcadeGame,dt:number){
    const alpha=1-Math.exp(-dt*19)
    this.group.rotation.z=Math.sin(game.time*.65)*.005+game.recoil*.007;this.group.rotation.x=-.37-game.recoil*.025;this.group.position.y=-.47+Math.sin(game.time*.9)*.002-game.recoil*.008
    for(let i=0;i<2;i++){
      const rig=this.rigs[i]!,id=i===0?'Left':'Right',side=i===0?-1:1,hand:ArcadeHand|undefined=game.hands.find(h=>h.id===id)??game.hands.filter(h=>h.id!=='Left'&&h.id!=='Right')[i],tx=hand?.thumb.x??0,ty=hand?.thumb.y??0,fire=hand?.firing?Math.pow(Math.max(0,Math.sin(game.time*75)),2):0
      rig.thumbX+=(tx-rig.thumbX)*alpha;rig.thumbY+=(ty-rig.thumbY)*alpha
      rig.thumb.pose(rig.thumbX*.045,rig.thumbY*.045,fire*.010)
      rig.stick.rotation.x=rig.thumbY*.16;rig.stick.rotation.y=-rig.thumbX*.16
      for(let j=0;j<4;j++){rig.curl[j]+=((hand?.curls[j]??.55)-rig.curl[j]!)*alpha;rig.fingers[j]!.pose(-side*(rig.curl[j]!-.5)*.012,0,j===0?fire*.025:0,rig.curl[j]!-.5)}
      rig.trigger.position.y=.405-fire*.018
      for(let j=0;j<rig.buttons.length;j++)rig.buttons[j]!.position.z=.17-(j===1?fire*.012:0)
    }
  }
}
