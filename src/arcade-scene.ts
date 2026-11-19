import * as THREE from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {ArcadeController} from './arcade-controller'
import {ArcadeCord} from './arcade-cord'
import {detailedRoom} from './arcade-room'
import {arcadeView,CONTROLLER_Y} from './arcade-view'
import type {ArcadeGame} from './arcade-game'
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
function box(w:number,h:number,d:number,material:THREE.Material,x=0,y=0,z=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);return mesh}
function shape(points:number[][],depth:number,material:THREE.Material,bevel=.025){const path=new THREE.Shape();points.forEach(([x,y],i)=>i?path.lineTo(x!,y!):path.moveTo(x!,y!));path.closePath();const g=new THREE.ExtrudeGeometry(path,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel});g.translate(0,0,-depth*.5);return new THREE.Mesh(g,material)}
export class ArcadeScene{
  readonly renderer:THREE.WebGLRenderer
  readonly scene=new THREE.Scene()
  readonly camera=new THREE.PerspectiveCamera(47,1,.05,50)
  private materials=new Map<string,THREE.MeshStandardMaterial>()
  private textures:THREE.Texture[]=[]
  private monitor:ArcadeMonitor
  private monitorVersion=-1
  private monitorTexture:THREE.CanvasTexture
  private monitorMaterial:THREE.ShaderMaterial
  private screenMesh:THREE.Mesh
  private controller=new ArcadeController()
  private cord=new ArcadeCord()
  private monitorPort=new THREE.Object3D()
  private cordStart=new THREE.Vector3()
  private cordEnd=new THREE.Vector3()
  private screenLight=new THREE.PointLight(0x83d0c3,13,7,2)
  private width=0
  private height=0
  private disposed=false
  constructor(canvas:HTMLCanvasElement,monitor:ArcadeMonitor){
    this.monitor=monitor
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true
    this.renderer.setClearColor('#10171d');this.scene.fog=new THREE.Fog('#171d27',11,25)
    this.scene.add(new THREE.HemisphereLight(0x9eaabd,0x543523,.48));const key=new THREE.DirectionalLight(0xffce9d,2.1);key.position.set(4,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-6,near:.5,far:28});key.shadow.bias=-.0007;key.shadow.normalBias=.025;this.scene.add(key)
    const blue=new THREE.DirectionalLight(0x658dcf,1.4);blue.position.set(-5,3,-1);this.scene.add(blue)
    this.screenLight.position.set(0,2.0,1.1);this.scene.add(this.screenLight)
    this.scene.add(detailedRoom())
    const caseGroup=new THREE.Group();caseGroup.position.set(0,1.93,-.55);this.scene.add(caseGroup)
    const casing=this.mat('#272f2b'),bezel=this.mat('#213b2b'),dark=this.mat('#0d1917')
    caseGroup.add(shape([[-2.07,-1.63],[2.07,-1.63],[2.18,-1.5],[2.18,1.5],[2.05,1.65],[-2.05,1.65],[-2.18,1.5],[-2.18,-1.5]],1.45,casing,.07))
    caseGroup.add(shape([[-2.04,-1.48],[2.04,-1.48],[2.1,-1.39],[2.1,1.46],[1.99,1.55],[-1.99,1.55],[-2.1,1.46],[-2.1,-1.39]],.08,bezel,.045));caseGroup.children[1]!.position.z=.77
    caseGroup.add(box(3.96,2.97,.08,dark,0,.05,.84))
    this.monitorTexture=new THREE.CanvasTexture(monitor.canvas);this.monitorTexture.minFilter=THREE.LinearFilter;this.monitorTexture.magFilter=THREE.NearestFilter;this.monitorTexture.generateMipmaps=false
    this.monitorMaterial=new THREE.ShaderMaterial({vertexShader:crtVertex,fragmentShader:crtFragment,uniforms:{uScreen:{value:this.monitorTexture},uTime:{value:0},uFlash:{value:0}}})
    const screen=new THREE.PlaneGeometry(3.74,2.805,24,18),position=screen.getAttribute('position')
    for(let i=0;i<position.count;i++){const x=position.getX(i)/1.87,y=position.getY(i)/1.4025;position.setZ(i,.13*(1-x*x*.5-y*y*.5))}position.needsUpdate=true;screen.computeVertexNormals()
    this.screenMesh=new THREE.Mesh(screen,this.monitorMaterial);this.screenMesh.position.set(0,.05,.90);caseGroup.add(this.screenMesh)
    caseGroup.add(box(.7,.08,.07,this.mat('#313d31'),0,-1.48,.87));caseGroup.add(box(.055,.026,.025,new THREE.MeshBasicMaterial({color:'#b5ef70'}),1.74,-1.48,.89))
    for(let i=0;i<4;i++)caseGroup.add(box(.12,.042,.04,this.mat('#354237'),.97+i*.18,-1.48,.89))
    for(let i=0;i<7;i++)caseGroup.add(box(.032,.34,.015,this.mat('#171f1b'),-1.79+i*.075,-1.37,.86))
    this.scene.add(box(.9,.27,.7,this.mat('#242e26'),0,.15,-.5));this.scene.add(box(2.4,.12,1.1,this.mat('#303b31'),0,-.01,-.3))
    const socket=this.mat('#24282d');caseGroup.add(box(.15,.24,.055,socket,-2.10,-.72,.91));caseGroup.add(box(.105,.16,.14,this.mat('#474b51'),-2.10,-.72,.995))
    this.monitorPort.position.set(-2.10,-.72,1.08);caseGroup.add(this.monitorPort)
    this.batchRoom();this.camera.add(this.controller.group);this.scene.add(this.camera);this.scene.add(this.cord.mesh);this.resize()
  }
  private mat(color:string){let m=this.materials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.68});this.materials.set(color,m)}return m}
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
      if(merged){const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;this.scene.add(mesh);for(const mesh of batch.meshes){mesh.removeFromParent();mesh.geometry.dispose()}}
      batch.geometries.forEach(g=>g.dispose())
    }
  }
  resize(){
    this.width=innerWidth;this.height=innerHeight;const aspect=this.width/this.height
    this.renderer.setSize(this.width,this.height,false);this.camera.aspect=aspect
    const view=arcadeView(aspect);this.camera.fov=view.fov;this.camera.position.set(...view.position);this.camera.lookAt(...view.target);this.camera.updateProjectionMatrix()
    this.controller.group.scale.setScalar(view.controllerScale);this.controller.group.position.y=CONTROLLER_Y
  }
  screenCenter(){const p=new THREE.Vector3();this.screenMesh.getWorldPosition(p);p.project(this.camera);return{x:(p.x*.5+.5)*this.width,y:(-.5*p.y+.5)*this.height}}
  render(game:ArcadeGame,dt:number){
    if(this.disposed)return
    if(this.monitorVersion!==this.monitor.version){this.monitorTexture.needsUpdate=true;this.monitorVersion=this.monitor.version}
    this.monitorMaterial.uniforms.uTime!.value=game.time;this.monitorMaterial.uniforms.uFlash!.value=game.flash
    this.screenLight.intensity=13+game.flash*1.5
    this.controller.update(game,dt)
    this.camera.updateMatrixWorld(true);this.scene.updateMatrixWorld(true)
    this.controller.cablePort.getWorldPosition(this.cordStart);this.monitorPort.getWorldPosition(this.cordEnd);this.cord.update(this.cordStart,this.cordEnd)
    this.renderer.render(this.scene,this.camera)
  }
  dispose(){
    this.disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>()
    this.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh instanceof THREE.SkinnedMesh)mesh.skeleton.dispose();if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m)})
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());const textures=new Set<THREE.Texture>(this.textures);for(const material of materials)for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);textures.forEach(t=>t.dispose());this.monitorTexture.dispose();this.renderer.dispose()
  }
}
