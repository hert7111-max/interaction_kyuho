import * as THREE from 'three'
import { FaceParticles } from './particle-engine'
import { coverScale } from './water-math'
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`
const cameraFunctions=`
uniform sampler2D uVideo;
uniform vec2 uCover;
uniform float uReady;
vec3 cameraAt(vec2 uv){vec2 p=(uv-.5)*uCover+.5;p.x=1.-p.x;return texture2D(uVideo,clamp(p,.001,.999)).rgb;}
float monochrome(vec3 color){float l=dot(color,vec3(.2126,.7152,.0722));return clamp((l-.46)*2.25+.5,0.,1.);}
`
const faceFragment=`
precision highp float;
varying vec2 vUv;
${cameraFunctions}
uniform sampler2D uHistory,uMask,uHoles;
uniform vec4 uFace;
uniform vec2 uDirection;
uniform float uGlitch,uTime,uHasFace,uHistoryReady;
float hash(float x){return fract(sin(x*127.1+31.7)*43758.5453);}
void main(){
  if(uReady<.5){float grain=hash(floor(vUv.x*600.)+floor(vUv.y*400.)*631.);gl_FragColor=vec4(vec3(.012+grain*.008),1.);return;}
  float live=monochrome(cameraAt(vUv));
  vec2 local=(vUv-uFace.xy)/max(uFace.zw,vec2(.001));
  float inBounds=step(0.,local.x)*step(local.x,1.)*step(0.,local.y)*step(local.y,1.);
  float mask=texture2D(uMask,clamp(local,.001,.999)).r*inBounds*uHasFace;
  float hole=texture2D(uHoles,clamp(local,.001,.999)).r;
  float row=floor(local.y*28.),column=floor(local.x*18.);
  float block=hash(row*71.+floor(uTime*7.));
  vec2 shift=uDirection*.014*uGlitch*(.35+block*2.5);
  shift.x+=(hash(row*5.+floor(uTime*5.))-.5)*.065*uGlitch;
  vec2 tileUv=vUv-shift;
  tileUv.y+=step(.78,hash(column+floor(uTime*4.)))*.014*uGlitch;
  float warped=monochrome(cameraAt(tileUv));
  vec3 old=texture2D(uHistory,clamp(vUv-shift*.48,.001,.999)).rgb;
  float held=dot(old,vec3(.3333));
  float persistence=uGlitch*uHistoryReady*(.55+block*.38);
  float moshed=mix(warped,held,clamp(persistence,0.,.94));
  moshed=mix(moshed,floor(moshed*7.)/7.,uGlitch*.23);
  float face=mix(live,moshed,uGlitch);
  vec2 left=vec2(uFace.x-uFace.z*.26,vUv.y),right=vec2(uFace.x+uFace.z*1.26,vUv.y);
  float behind=(monochrome(cameraAt(left))+monochrome(cameraAt(right)))*.42;
  float result=mix(live,mix(face,behind,hole),mask);
  gl_FragColor=vec4(vec3(result),1.);
}`
const snapshotFragment=`precision highp float;varying vec2 vUv;${cameraFunctions}void main(){float value=monochrome(cameraAt(vUv));gl_FragColor=vec4(vec3(value),1.);}`
const particleVertex=`
precision highp float;
uniform sampler2D uSnapshot,uVideo;
uniform vec2 uCover;
uniform float uPointSize,uReturn;
attribute vec2 aUv,aSnapshotUv;
attribute float aAlpha,aSeed;
varying vec3 vColor;
varying float vAlpha,vSeed;
vec3 palette(float t){
  if(t<.16)return mix(vec3(.77,.84,.42),vec3(1.,.45,.06),t/.16);
  if(t<.33)return mix(vec3(1.,.45,.06),vec3(1.,.60,.38),(t-.16)/.17);
  if(t<.58)return mix(vec3(1.,.60,.38),vec3(.96,.63,.90),(t-.33)/.25);
  if(t<.77)return mix(vec3(.96,.63,.90),vec3(.77,.61,.94),(t-.58)/.19);
  return mix(vec3(.77,.61,.94),vec3(.58,.52,.91),(t-.77)/.23);
}
void main(){
  gl_Position=vec4(position.xy*2.-1.,0.,1.);
  gl_PointSize=uPointSize*(.65+aSeed*.65);
  float luma=texture2D(uSnapshot,aSnapshotUv).r;
  vec2 liveUV=(position.xy-.5)*uCover+.5;liveUV.x=1.-liveUV.x;
  float current=dot(texture2D(uVideo,clamp(liveUV,.001,.999)).rgb,vec3(.2126,.7152,.0722));
  current=clamp((current-.46)*2.25+.5,0.,1.);
  vec3 color=palette(clamp(aUv.x*.57+aUv.y*.28+aSeed*.18,0.,1.));
  vColor=mix(color*(.3+luma*.7),vec3(current),smoothstep(.55,1.,uReturn));
  vAlpha=aAlpha;vSeed=aSeed;
}`
const particleFragment=`precision highp float;varying vec3 vColor;varying float vAlpha,vSeed;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float circle=1.-smoothstep(.32,.50,d);float square=step(abs(p.x),.46)*step(abs(p.y),.46);float shape=mix(circle,square,step(.72,vSeed));if(vAlpha*shape<.008)discard;gl_FragColor=vec4(vColor,vAlpha*shape);}`
export class ParticleRenderer{
  readonly renderer:THREE.WebGLRenderer
  private camera=new THREE.Camera()
  private scene=new THREE.Scene()
  private pointScene=new THREE.Scene()
  private quad:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>
  private material:THREE.ShaderMaterial
  private snapshotMaterial:THREE.ShaderMaterial
  private points:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>
  private videoTexture:THREE.VideoTexture
  private history:THREE.WebGLRenderTarget[]
  private snapshot:THREE.WebGLRenderTarget
  private maskCanvas=document.createElement('canvas')
  private maskContext:CanvasRenderingContext2D
  private maskTexture:THREE.CanvasTexture
  private holes:THREE.DataTexture
  private serial=0
  private historyReady=false
  private maskTime=0
  private disposed=false
  ready=false
  readonly engine:FaceParticles
  constructor(canvas:HTMLCanvasElement,video:HTMLVideoElement,engine:FaceParticles){
    this.engine=engine
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'})
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.autoClear=false;this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace
    this.videoTexture=new THREE.VideoTexture(video);this.videoTexture.colorSpace=THREE.NoColorSpace
    this.history=[0,1].map(()=>new THREE.WebGLRenderTarget(512,512,{depthBuffer:false,stencilBuffer:false}))
    this.snapshot=new THREE.WebGLRenderTarget(512,512,{depthBuffer:false,stencilBuffer:false})
    this.maskCanvas.width=this.maskCanvas.height=256;this.maskContext=this.maskCanvas.getContext('2d')!
    this.maskTexture=new THREE.CanvasTexture(this.maskCanvas)
    this.holes=new THREE.DataTexture(engine.holes,engine.columns,engine.rows,THREE.RGBAFormat,THREE.UnsignedByteType);this.holes.magFilter=THREE.NearestFilter;this.holes.minFilter=THREE.NearestFilter;this.holes.needsUpdate=true
    const cameraUniforms={uVideo:{value:this.videoTexture},uCover:{value:new THREE.Vector2(1,1)},uReady:{value:0}}
    this.material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:faceFragment,depthTest:false,depthWrite:false,uniforms:{...cameraUniforms,uHistory:{value:null},uMask:{value:this.maskTexture},uHoles:{value:this.holes},uFace:{value:new THREE.Vector4(0,0,1,1)},uDirection:{value:new THREE.Vector2(1,0)},uGlitch:{value:0},uTime:{value:0},uHasFace:{value:0},uHistoryReady:{value:0}}})
    this.snapshotMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:snapshotFragment,depthTest:false,depthWrite:false,uniforms:{...cameraUniforms,uCover:{value:new THREE.Vector2(1,1)}}})
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.scene.add(this.quad)
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.BufferAttribute(engine.positions,3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aUv',new THREE.BufferAttribute(engine.uv,2));geometry.setAttribute('aSnapshotUv',new THREE.BufferAttribute(engine.snapshotUV,2).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aAlpha',new THREE.BufferAttribute(engine.alpha,1).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('aSeed',new THREE.BufferAttribute(engine.random,1))
    const material=new THREE.ShaderMaterial({vertexShader:particleVertex,fragmentShader:particleFragment,transparent:true,depthTest:false,depthWrite:false,uniforms:{uSnapshot:{value:this.snapshot.texture},uVideo:{value:this.videoTexture},uCover:{value:new THREE.Vector2(1,1)},uPointSize:{value:3},uReturn:{value:0}}})
    this.points=new THREE.Points(geometry,material);this.points.frustumCulled=false;this.pointScene.add(this.points);this.resize()
  }
  resize(){
    this.renderer.setSize(innerWidth,innerHeight,false)
    const width=Math.min(1024,innerWidth),height=Math.max(128,Math.round(width*innerHeight/innerWidth))
    this.history.forEach(target=>target.setSize(width,height));this.snapshot.setSize(width,height);this.historyReady=false
  }
  invalidate(){this.historyReady=false}
  private updateMask(){
    const face=this.engine.face,ctx=this.maskContext;ctx.clearRect(0,0,256,256)
    if(face){ctx.fillStyle='#fff';ctx.beginPath();face.contour.forEach((p,i)=>{const x=(p.x-face.x)/face.width*256,y=(1-(p.y-face.y)/face.height)*256;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.closePath();ctx.fill()}
    this.maskTexture.needsUpdate=true
  }
  render(videoAspect:number,dt:number){
    if(this.disposed)return
    const engine=this.engine,scale=coverScale(videoAspect,innerWidth/innerHeight),u=this.material.uniforms
    u.uCover!.value.set(scale.x,scale.y);u.uReady!.value=Number(this.ready);u.uTime!.value=engine.time;u.uGlitch!.value=engine.glitch
    u.uDirection!.value.set(engine.direction.x/engine.aspect,engine.direction.y)
    this.points.material.uniforms.uCover!.value.set(scale.x,scale.y)
    this.snapshotMaterial.uniforms.uCover!.value.set(scale.x,scale.y)
    if(engine.face){const face=engine.face;u.uFace!.value.set(face.x,face.y,face.width,face.height);u.uHasFace!.value=1}else u.uHasFace!.value=0
    // The resting camera needs one simple monochrome pass, without feedback or particle uploads.
    if(engine.stage==='idle'){
      this.historyReady=false;this.quad.material=this.ready?this.snapshotMaterial:this.material
      this.renderer.setRenderTarget(null);this.renderer.clear();this.renderer.render(this.scene,this.camera);this.quad.material=this.material
      return
    }
    this.maskTime+=dt;if(this.maskTime>.06){this.updateMask();this.maskTime=0}
    if(engine.burstSerial!==this.serial){
      this.serial=engine.burstSerial;this.snapshotMaterial.uniforms.uCover!.value.set(scale.x,scale.y)
      this.quad.material=this.snapshotMaterial;this.renderer.setRenderTarget(this.snapshot);this.renderer.clear();this.renderer.render(this.scene,this.camera);this.quad.material=this.material
      this.points.geometry.getAttribute('aSnapshotUv').needsUpdate=true
    }
    this.holes.needsUpdate=true
    u.uHistory!.value=this.history[0]!.texture;u.uHistoryReady!.value=Number(this.historyReady)
    this.renderer.setRenderTarget(this.history[1]!);this.renderer.clear();this.renderer.render(this.scene,this.camera)
    this.renderer.setRenderTarget(null);this.renderer.clear();this.renderer.render(this.scene,this.camera)
    this.points.geometry.getAttribute('position').needsUpdate=true;this.points.geometry.getAttribute('aAlpha').needsUpdate=true
    const face=engine.face,size=face?Math.max(face.width*innerWidth/engine.columns,face.height*innerHeight/engine.rows)*1.35:3
    this.points.material.uniforms.uPointSize!.value=Math.max(1.8,Math.min(7,size))*this.renderer.getPixelRatio()
    this.points.material.uniforms.uReturn!.value=engine.stage==='returning'?Math.min(1,(engine.time-engine.returnAt)/2.6):0
    this.renderer.render(this.pointScene,this.camera)
    this.history.reverse();this.historyReady=this.ready
  }
  dispose(){this.disposed=true;this.videoTexture.dispose();this.history.forEach(t=>t.dispose());this.snapshot.dispose();this.maskTexture.dispose();this.holes.dispose();this.material.dispose();this.snapshotMaterial.dispose();this.quad.geometry.dispose();this.points.geometry.dispose();this.points.material.dispose();this.renderer.dispose()}
}
