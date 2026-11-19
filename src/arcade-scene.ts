import * as THREE from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import type {ArcadeGame,ArcadeHand} from './arcade-game'
import type {ArcadeMonitor} from './arcade-monitor'
const crtVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const crtFragment=`precision highp float;varying vec2 vUv;uniform sampler2D uScreen;uniform float uTime,uFlash;
float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
 vec2 q=vUv*2.-1.;vec2 edge=max(abs(q)-vec2(.935,.92),0.);if(length(edge)>.065)discard;
 vec2 uv=vUv;float roll=exp(-pow((uv.y-fract(uTime*.083))/.028,2.));
 uv.x+=sin(uv.y*440.+uTime*18.)*.0008+roll*sin(uTime*7.)*.002;
 vec3 col=vec3(texture2D(uScreen,uv+vec2(.0018,0.)).r,texture2D(uScreen,uv).g,texture2D(uScreen,uv-vec2(.0016,0.)).b);
 float luma=dot(col,vec3(.299,.587,.114));col=mix(vec3(luma),col,.78)*vec3(.89,1.04,1.02);
 float scan=.84+.16*sin(vUv.y*480.*3.14159);col*=scan;
 col+=((noise(floor(vUv*vec2(640.,480.))+floor(uTime*24.))-.5)*.045)+roll*.025;
 col*=1.-.26*dot(q*q,q*q);col+=vec3(.025,.045,.035)+uFlash*.008;
 float reflection=pow(max(0.,1.-length((vUv-vec2(.18,.93))*vec2(1.3,2.8))),8.);col+=vec3(.12,.16,.15)*reflection;
 gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`
type HandRig={root:THREE.Group;thumb:THREE.Group;fingers:THREE.Group[];stick:THREE.Group;trigger:THREE.Mesh;buttons:THREE.Group[]}
function box(w:number,h:number,d:number,material:THREE.Material,x=0,y=0,z=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);return mesh}
function shape(points:number[][],depth:number,material:THREE.Material,bevel=.025){const path=new THREE.Shape();points.forEach(([x,y],i)=>i?path.lineTo(x!,y!):path.moveTo(x!,y!));path.closePath();const g=new THREE.ExtrudeGeometry(path,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel});g.translate(0,0,-depth*.5);return new THREE.Mesh(g,material)}
function bone(a:THREE.Vector3,b:THREE.Vector3,r1:number,r2:number,material:THREE.Material){const delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,delta.length(),5,1),material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh}
export class ArcadeScene{
  readonly renderer:THREE.WebGLRenderer
  readonly scene=new THREE.Scene()
  readonly camera=new THREE.PerspectiveCamera(47,1,.05,50)
  private materials=new Map<string,THREE.MeshLambertMaterial>()
  private textures:THREE.Texture[]=[]
  private monitor:ArcadeMonitor
  private monitorVersion=-1
  private monitorTexture:THREE.CanvasTexture
  private monitorMaterial:THREE.ShaderMaterial
  private screenMesh:THREE.Mesh
  private controller=new THREE.Group()
  private rigs:HandRig[]=[]
  private screenLight=new THREE.PointLight(0x83d0c3,13,7,2)
  private target=new THREE.Vector3(0,1.7,-.4)
  private width=0
  private height=0
  private disposed=false
  constructor(canvas:HTMLCanvasElement,monitor:ArcadeMonitor){
    this.monitor=monitor
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));this.renderer.outputColorSpace=THREE.SRGBColorSpace
    this.renderer.setClearColor('#10171d');this.scene.fog=new THREE.Fog('#171d27',11,25)
    this.scene.add(new THREE.HemisphereLight(0xaaa6bc,0x252128,1.1));const key=new THREE.DirectionalLight(0xf5c6a0,1.8);key.position.set(-4,6,5);this.scene.add(key)
    const blue=new THREE.DirectionalLight(0x5789ba,.7);blue.position.set(5,2,-1);this.scene.add(blue)
    this.screenLight.position.set(0,2.0,1.1);this.scene.add(this.screenLight)
    this.room()
    const caseGroup=new THREE.Group();caseGroup.position.set(0,1.93,-.55);this.scene.add(caseGroup)
    const casing=this.mat('#92988e'),bezel=this.mat('#b5b9a6'),dark=this.mat('#1a2428')
    caseGroup.add(shape([[-2.07,-1.63],[2.07,-1.63],[2.18,-1.5],[2.18,1.5],[2.05,1.65],[-2.05,1.65],[-2.18,1.5],[-2.18,-1.5]],1.45,casing,.07))
    caseGroup.add(shape([[-2.04,-1.48],[2.04,-1.48],[2.1,-1.39],[2.1,1.46],[1.99,1.55],[-1.99,1.55],[-2.1,1.46],[-2.1,-1.39]],.08,bezel,.045));caseGroup.children[1]!.position.z=.77
    caseGroup.add(box(3.96,2.97,.08,dark,0,.05,.84))
    this.monitorTexture=new THREE.CanvasTexture(monitor.canvas);this.monitorTexture.minFilter=THREE.LinearFilter;this.monitorTexture.magFilter=THREE.NearestFilter;this.monitorTexture.generateMipmaps=false
    this.monitorMaterial=new THREE.ShaderMaterial({vertexShader:crtVertex,fragmentShader:crtFragment,uniforms:{uScreen:{value:this.monitorTexture},uTime:{value:0},uFlash:{value:0}}})
    const screen=new THREE.PlaneGeometry(3.74,2.805,24,18),position=screen.getAttribute('position')
    for(let i=0;i<position.count;i++){const x=position.getX(i)/1.87,y=position.getY(i)/1.4025;position.setZ(i,.13*(1-x*x*.5-y*y*.5))}position.needsUpdate=true;screen.computeVertexNormals()
    this.screenMesh=new THREE.Mesh(screen,this.monitorMaterial);this.screenMesh.position.set(0,.05,.90);caseGroup.add(this.screenMesh)
    caseGroup.add(box(.7,.08,.07,this.mat('#7e897e'),0,-1.48,.87));caseGroup.add(box(.055,.026,.025,new THREE.MeshBasicMaterial({color:'#b5ef70'}),1.74,-1.48,.89))
    for(let i=0;i<4;i++)caseGroup.add(box(.12,.042,.04,this.mat('#7c837b'),.97+i*.18,-1.48,.89))
    for(let i=0;i<7;i++)caseGroup.add(box(.032,.34,.015,this.mat('#6d776e'),-1.79+i*.075,-1.37,.86))
    this.scene.add(box(.9,.27,.7,this.mat('#7c857b'),0,.15,-.5));this.scene.add(box(2.4,.12,1.1,this.mat('#939889'),0,-.01,-.3))
    this.batchRoom();this.buildController();this.camera.add(this.controller);this.scene.add(this.camera);this.resize()
  }
  private mat(color:string){let m=this.materials.get(color);if(!m){m=new THREE.MeshLambertMaterial({color,flatShading:true});this.materials.set(color,m)}return m}
  private room(){
    const wall=this.mat('#414b48'),side=this.mat('#35464b'),wood=this.mat('#514039')
    this.scene.add(box(15,7,.14,wall,0,2.9,-3.1));this.scene.add(box(.15,7,12,side,-5,2.9,1));this.scene.add(box(.15,7,12,this.mat('#514b50'),5,2.9,1));this.scene.add(box(10,.12,12,this.mat('#26363a'),0,6.1,1))
    this.scene.add(box(9,.2,6.6,wood,0,-.12,.6));this.scene.add(box(9,.13,.10,this.mat('#8b6b4c'),0,-.05,3.86))
    for(const x of [-3.8,3.8])for(const z of [-2,3])this.scene.add(box(.15,1.6,.15,this.mat('#2a3232'),x,-1,z))
    for(let i=0;i<14;i++)this.scene.add(box(8.9,.005,.012,this.mat(i%3?'#594439':'#6f5141'),0,-.013,-2.4+i*.43))
    for(const x of [-3.5,3.5])this.window(x)
    // Compact twin speakers, memory-card era console, a mousepad and a faceted mug.
    for(const x of [-2.65,2.65]){
      this.scene.add(box(.44,.95,.42,this.mat('#2b343a'),x,.45,-.65))
      for(const y of [.28,.66]){const cone=new THREE.Mesh(new THREE.CylinderGeometry(y>.5?.12:.16,y>.5?.12:.16,.024,10),this.mat('#15252c'));cone.rotation.x=Math.PI/2;cone.position.set(x,y,-.42);this.scene.add(cone)}
    }
    const consoleGroup=new THREE.Group();consoleGroup.position.set(2.65,.09,1.05);consoleGroup.rotation.y=-.12
    for(let i=0;i<5;i++)consoleGroup.add(box(1.6,.06,.95,this.mat(i%2?'#17242b':'#27343a'),0,i*.055,0))
    consoleGroup.add(box(1.15,.035,.025,this.mat('#0b141a'),-.08,.17,.49));consoleGroup.add(box(.06,.02,.025,new THREE.MeshBasicMaterial({color:'#557af4'}),.65,.18,.50));this.scene.add(consoleGroup)
    this.scene.add(box(1.3,.014,.95,this.mat('#25383b'),-2.5,.005,1.7))
    const mug=new THREE.Mesh(new THREE.CylinderGeometry(.19,.14,.39,7,1),this.mat('#4c827d'));mug.position.set(-2.6,.2,.2);this.scene.add(mug)
    const coffee=new THREE.Mesh(new THREE.CircleGeometry(.16,7),this.mat('#201c22'));coffee.rotation.x=-Math.PI/2;coffee.position.set(-2.6,.401,.2);this.scene.add(coffee)
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.14,.035,4,7),this.mat('#4c827d'));handle.position.set(-2.81,.22,.2);this.scene.add(handle)
    const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(2.7,.02,1.6),new THREE.Vector3(1.7,.02,2),new THREE.Vector3(1,.02,2.7),new THREE.Vector3(.3,.02,2.9)]);this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(cable,14,.018,4,false),this.mat('#111d24')))
  }
  private window(x:number){
    const g=new THREE.Group();g.position.set(x,2.6,-2.99);this.scene.add(g)
    const canvas=document.createElement('canvas');canvas.width=96;canvas.height=144;const c=canvas.getContext('2d')!
    const gradient=c.createLinearGradient(0,0,0,144);gradient.addColorStop(0,'#252b53');gradient.addColorStop(.65,'#755268');gradient.addColorStop(1,'#c18571');c.fillStyle=gradient;c.fillRect(0,0,96,144)
    for(let i=0;i<16;i++){const bx=i*8-10,by=60+(i*37)%55;c.fillStyle=i%2?'#283746':'#1a2c38';c.fillRect(bx,by,10+(i%3)*4,144-by);c.fillStyle='#d8aa666b';for(let y=by+5;y<142;y+=9)for(let xx=bx+3;xx<bx+9;xx+=5)if((i+y)%4)c.fillRect(xx,y,2,3)}
    const texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearFilter;texture.colorSpace=THREE.SRGBColorSpace;this.textures.push(texture)
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(1.75,2.7),new THREE.MeshBasicMaterial({map:texture}));g.add(pane)
    const frame=this.mat('#182b32');for(const bx of [-.94,0,.94])g.add(box(.09,2.95,.13,frame,bx,0,.04));for(const y of [-1.46,0,1.46])g.add(box(1.98,.09,.13,frame,0,y,.04))
    g.add(box(2.14,.12,.38,this.mat('#61706a'),0,-1.52,.12))
    const blind=this.mat('#76837c');for(let i=0;i<4;i++){const slat=box(2.02,.085,.09,blind,0,1.26-i*.12,.17);slat.rotation.x=.15;g.add(slat)}
  }
  private buildController(){
    const body=this.mat('#202a31'),edge=this.mat('#101a23'),skin=this.mat('#bc8f70'),skinShade=this.mat('#9a6a52'),nail=this.mat('#d5b296')
    const face=[[-.78,.20],[-.70,.35],[-.43,.36],[-.26,.24],[.26,.24],[.43,.36],[.70,.35],[.78,.20],[.89,-.34],[.80,-.50],[.62,-.47],[.43,-.15],[-.43,-.15],[-.62,-.47],[-.80,-.50],[-.89,-.34]]
    this.controller.add(shape(face,.22,body,.045))
    this.controller.position.set(0,-.50,-2.7);this.controller.rotation.x=-.24
    const cord=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.31,-.08),new THREE.Vector3(0,.55,-.24),new THREE.Vector3(.35,.8,-.6),new THREE.Vector3(1.4,.7,-1.8)]);this.controller.add(new THREE.Mesh(new THREE.TubeGeometry(cord,15,.014,4,false),edge))
    this.controller.add(box(.06,.06,.08,edge,0,.33,-.04))
    for(const side of [-1,1]){
      const stick=new THREE.Group();stick.position.set(side*.245,-.045,.14);this.controller.add(stick)
      const socket=new THREE.Mesh(new THREE.CylinderGeometry(.137,.137,.04,10),edge);socket.rotation.x=Math.PI/2;stick.add(socket)
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(.097,.10,.07,10),this.mat('#414850'));cap.rotation.x=Math.PI/2;cap.position.z=.066;stick.add(cap)
      const trigger=box(.27,.10,.14,this.mat('#303d43'),side*.58,.35,-.04);this.controller.add(trigger)
      const buttons:THREE.Group[]=[]
      if(side<0){this.controller.add(box(.24,.072,.055,edge,-.55,.16,.16));this.controller.add(box(.072,.24,.055,edge,-.55,.16,.16));this.controller.add(box(.05,.05,.012,this.mat('#556168'),-.55,.16,.195))}
      else for(let i=0;i<4;i++){
        const group=new THREE.Group(),positions=[[.55,.28],[.67,.16],[.55,.04],[.43,.16]],pos=positions[i]!
        group.position.set(pos[0]!,pos[1]!, .15);const button=new THREE.Mesh(new THREE.CylinderGeometry(.066,.07,.045,10),this.mat('#152027'));button.rotation.x=Math.PI/2;group.add(button)
        const colors=['#6ab8a0','#d26973','#739ec3','#c589b2'],points=i===0?[[-.028,-.024],[0,.028],[.028,-.024],[-.028,-.024]]:i===1?Array.from({length:17},(_,j)=>[Math.cos(j/16*6.28)*.029,Math.sin(j/16*6.28)*.029]):i===2?[[-.025,-.025],[.025,.025],[0,0],[-.025,.025],[.025,-.025]]:[[-.026,-.026],[.026,-.026],[.026,.026],[-.026,.026],[-.026,-.026]]
        const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p[0],p[1],.027)));group.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:colors[i]})));this.controller.add(group);buttons.push(group)
      }
      this.controller.add(box(.075,.03,.025,this.mat('#697476'),side*.075,.14,.15))
      const hand=new THREE.Group();this.controller.add(hand)
      const palm=box(.28,.36,.19,skin,side*.79,-.27,.11);palm.rotation.z=side*.25;hand.add(palm)
      hand.add(bone(new THREE.Vector3(side*.83,-.44,.11),new THREE.Vector3(side*1.02,-.96,.57),.16,.20,this.mat('#334b5c')))
      const cuff=box(.36,.15,.26,this.mat('#50687b'),side*.85,-.52,.22);cuff.rotation.z=side*.25;hand.add(cuff)
      const thumb=new THREE.Group();thumb.position.set(side*.68,-.13,.20);hand.add(thumb)
      thumb.add(bone(new THREE.Vector3(),new THREE.Vector3(-side*.15,.13,.06),.085,.073,skin));thumb.add(bone(new THREE.Vector3(-side*.15,.13,.06),new THREE.Vector3(-side*.31,.19,.085),.073,.062,skin));const thumbNail=box(.085,.065,.012,nail,-side*.29,.19,.145);thumbNail.rotation.z=-side*.2;thumb.add(thumbNail)
      const fingers:THREE.Group[]=[]
      for(let i=0;i<4;i++){
        const finger=new THREE.Group();finger.position.set(side*(i===0?.70:.79),i===0?.07:-.13-i*.08,i===0?.035:.15);hand.add(finger)
        if(i===0){finger.add(bone(new THREE.Vector3(),new THREE.Vector3(-side*.09,.18,-.06),.055,.049,skin));finger.add(bone(new THREE.Vector3(-side*.09,.18,-.06),new THREE.Vector3(-side*.12,.23,.05),.049,.045,skinShade))}
        else{finger.add(bone(new THREE.Vector3(),new THREE.Vector3(-side*.04,.015,.12),.055-i*.004,.05-i*.003,skin));finger.add(bone(new THREE.Vector3(-side*.04,.015,.12),new THREE.Vector3(-side*.16,.035,.15),.05-i*.003,.04,skinShade));finger.add(box(.055,.045,.012,nail,-side*.14,.04,.19))}
        fingers.push(finger)
      }
      this.rigs.push({root:hand,thumb,fingers,stick,trigger,buttons})
    }
    this.controller.add(box(.038,.012,.02,new THREE.MeshBasicMaterial({color:'#d85043'}),0,.04,.16))
  }
  private batchRoom(){
    this.scene.updateMatrixWorld(true)
    const batches=new Map<THREE.Material,{geometries:THREE.BufferGeometry[];meshes:THREE.Mesh[]}>()
    this.scene.traverse(object=>{
      const mesh=object as THREE.Mesh
      if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.material instanceof THREE.ShaderMaterial)return
      const material=mesh.material
      let batch=batches.get(material);if(!batch){batch={geometries:[],meshes:[]};batches.set(material,batch)}
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()
      geometry.applyMatrix4(mesh.matrixWorld);batch.geometries.push(geometry);batch.meshes.push(mesh)
    })
    for(const [material,batch] of batches){
      const merged=mergeGeometries(batch.geometries,false)
      if(merged){this.scene.add(new THREE.Mesh(merged,material));for(const mesh of batch.meshes){mesh.removeFromParent();mesh.geometry.dispose()}}
      batch.geometries.forEach(g=>g.dispose())
    }
  }
  resize(){
    this.width=innerWidth;this.height=innerHeight;const aspect=this.width/this.height
    this.renderer.setSize(this.width,this.height,false);this.camera.aspect=aspect
    this.camera.position.set(0,2.30,Math.max(5.35,4.55/(2*Math.tan(47/360*Math.PI)*aspect)*1.08-.5));this.camera.lookAt(this.target);this.camera.updateProjectionMatrix()
    const scale=Math.min(1,aspect/1.15);this.controller.scale.setScalar(scale);this.controller.position.y=-.50
  }
  screenCenter(){const p=new THREE.Vector3();this.screenMesh.getWorldPosition(p);p.project(this.camera);return{x:(p.x*.5+.5)*this.width,y:(-.5*p.y+.5)*this.height}}
  render(game:ArcadeGame,dt:number){
    if(this.disposed)return
    if(this.monitorVersion!==this.monitor.version){this.monitorTexture.needsUpdate=true;this.monitorVersion=this.monitor.version}
    this.monitorMaterial.uniforms.uTime!.value=game.time;this.monitorMaterial.uniforms.uFlash!.value=game.flash
    this.screenLight.intensity=13+game.flash*1.5
    const a=1-Math.exp(-dt*18)
    this.controller.rotation.z=Math.sin(game.time*.7)*.006+game.recoil*.015;this.controller.rotation.x=-.24-game.recoil*.04;this.controller.position.y=-.50+Math.sin(game.time*1.1)*.003-game.recoil*.012
    for(let index=0;index<2;index++){
      const rig=this.rigs[index]!,id=index===0?'Left':'Right',hand=game.hands.find(h=>h.id===id)??game.hands.filter(h=>h.id!=='Left'&&h.id!=='Right')[index]
      this.animateHand(rig,hand,index===0?-1:1,game,a)
    }
    this.renderer.render(this.scene,this.camera)
  }
  private animateHand(rig:HandRig,hand:ArcadeHand|undefined,side:number,game:ArcadeGame,alpha:number){
    const activity=hand?.activity??0,thumb=hand?.thumb??{x:0,y:0},fire=hand?.firing?Math.pow(Math.max(0,Math.sin(game.time*75)),2):0
    rig.root.rotation.z+=(side*activity*.035-rig.root.rotation.z)*alpha
    rig.thumb.rotation.z+=(-thumb.x*.23+side*activity*.06-rig.thumb.rotation.z)*alpha;rig.thumb.rotation.x+=(thumb.y*.25+fire*.14-rig.thumb.rotation.x)*alpha
    rig.stick.rotation.x+=(thumb.y*.18-rig.stick.rotation.x)*alpha;rig.stick.rotation.y+=(-thumb.x*.18-rig.stick.rotation.y)*alpha
    for(let i=0;i<4;i++){const curl=hand?.curls[i]??.55;rig.fingers[i]!.rotation.x+=((curl-.5)*.55+(i===0?fire*.28:0)-rig.fingers[i]!.rotation.x)*alpha}
    rig.trigger.position.y=.35-fire*.025-(hand?.curls[0]??.5)*.012
    for(let i=0;i<rig.buttons.length;i++)rig.buttons[i]!.position.z=.15-(i===Math.floor((thumb.x+1)*1.5)%4?Math.abs(thumb.y)*.012+fire*.014:0)
  }
  dispose(){
    this.disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>()
    this.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m)})
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.monitorTexture.dispose();this.renderer.dispose()
  }
}
