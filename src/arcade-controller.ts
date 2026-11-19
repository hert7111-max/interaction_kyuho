import * as THREE from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {UnifiedHand,handMaterials} from './arcade-hand'
import {CONTROLLER_Y} from './arcade-view'
import type {ArcadeGame,ArcadeHand} from './arcade-game'
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
function rounded(w:number,h:number,d:number,m:THREE.Material,x=0,y=0,z=0,r=.025){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),m);mesh.position.set(x,y,z);return mesh}
type Rig={hand:UnifiedHand;stick:THREE.Group;trigger:THREE.Mesh;buttons:THREE.Group[];thumbX:number;thumbY:number;curl:number[]}
export class ArcadeController{
  readonly group=new THREE.Group()
  readonly cablePort=new THREE.Object3D()
  private rigs:Rig[]=[]
  constructor(){
    const plastic=new THREE.MeshStandardMaterial({color:'#c5c3bc',roughness:.58}),rear=new THREE.MeshStandardMaterial({color:'#9a9b98',roughness:.66}),rubber=new THREE.MeshStandardMaterial({color:'#282b30',roughness:.91})
    const {skin,nail}=handMaterials()
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
      const hand=new UnifiedHand(side,skin,nail);this.group.add(hand.group)
      this.rigs.push({hand,stick,trigger,buttons,thumbX:0,thumbY:0,curl:[.5,.5,.5,.5]})
    }
    const label=document.createElement('canvas');label.width=256;label.height=64;const c=label.getContext('2d')!;c.clearRect(0,0,256,64);c.fillStyle='#464a4e';c.font='bold 27px serif';c.textAlign='center';c.fillText('SONY',128,27);c.font='12px sans-serif';c.fillText('DUAL ANALOG',128,47)
    const texture=new THREE.CanvasTexture(label);const print=new THREE.Mesh(new THREE.PlaneGeometry(.34,.085),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));print.position.set(0,.222,.158);this.group.add(print)
    this.group.add(rounded(.055,.015,.012,new THREE.MeshBasicMaterial({color:'#cd3a42'}),0,.025,.158,.004))
    const plug=rounded(.11,.09,.16,rubber,0,.32,-.015,.018);this.group.add(plug);this.cablePort.position.set(0,.37,-.085);this.group.add(this.cablePort)
    this.group.position.set(0,CONTROLLER_Y,-3.15);this.group.rotation.x=-.28
  }
  update(game:ArcadeGame,dt:number){
    const alpha=1-Math.exp(-dt*19)
    this.group.rotation.z=Math.sin(game.time*.65)*.005+Math.sin(game.time*37)*game.recoil*.018;this.group.rotation.x=-.28-game.recoil*.065;this.group.position.y=CONTROLLER_Y+Math.sin(game.time*.9)*.002-game.recoil*.024
    for(let i=0;i<2;i++){
      const rig=this.rigs[i]!,id=i===0?'Left':'Right',hand:ArcadeHand|undefined=game.hands.find(h=>h.id===id)??game.hands.filter(h=>h.id!=='Left'&&h.id!=='Right')[i],firing=hand?.firing&&!game.dead,fire=firing?.5+.5*Math.sin(game.time*Math.PI*24+i*.7):0,tx=(hand?.thumb.x??0)+(firing?Math.sin(game.time*18+i)*.32:0),ty=(hand?.thumb.y??0)+(firing?Math.cos(game.time*22+i)*.28:0)
      rig.thumbX+=(tx-rig.thumbX)*alpha;rig.thumbY+=(ty-rig.thumbY)*alpha
      rig.stick.rotation.x=rig.thumbY*.25;rig.stick.rotation.y=-rig.thumbX*.25
      for(let j=0;j<4;j++)rig.curl[j]+=((hand?.curls[j]??.55)-rig.curl[j]!)*alpha
      rig.hand.pose(rig.thumbX,rig.thumbY,fire,rig.curl)
      rig.trigger.position.y=.405-fire*.040
      for(let j=0;j<rig.buttons.length;j++)rig.buttons[j]!.position.z=.17-(j===1?fire*.027:0)
    }
  }
}
