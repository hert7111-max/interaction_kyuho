import * as THREE from 'three'
import {FingertipDatamosh} from './particle-engine'
import {coverScale} from './water-math'
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`
const cameraFunctions=`
uniform sampler2D uVideo;
uniform vec2 uCover;
uniform float uReady;
vec3 cameraAt(vec2 uv){vec2 p=(uv-.5)*uCover+.5;p.x=1.-p.x;return texture2D(uVideo,clamp(p,.001,.999)).rgb;}
float mono(vec3 c){return clamp((dot(c,vec3(.2126,.7152,.0722))-.5)*1.08+.5,0.,1.);}
`
const plainFragment=`precision highp float;varying vec2 vUv;${cameraFunctions}void main(){gl_FragColor=vec4(vec3(uReady>.5?mono(cameraAt(vUv)):.018),1.);}`
const glitchFragment=`
precision highp float;
varying vec2 vUv;
${cameraFunctions}
uniform sampler2D uHistory,uMask,uField;
uniform vec4 uFace;
uniform vec2 uPixel;
uniform float uTime,uHistoryReady;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 palette(float n){
  if(n<.18)return vec3(.96,.10,.61);
  if(n<.36)return vec3(.14,.86,.91);
  if(n<.52)return vec3(1.,.83,.15);
  if(n<.72)return vec3(.47,.26,.67);
  if(n<.87)return vec3(.53,.05,.21);
  return vec3(.38,.59,.06);
}
void main(){
  vec3 live=vec3(mono(cameraAt(vUv)));
  vec2 local=(vUv-uFace.xy)/max(uFace.zw,vec2(.001));
  float bounds=step(0.,local.x)*step(local.x,1.)*step(0.,local.y)*step(local.y,1.);
  vec4 field=texture2D(uField,clamp(local,.001,.999));
  float amount=field.r*texture2D(uMask,clamp(local,.001,.999)).r*bounds;
  // Exact output gate: feedback, displacement and color cannot escape the touched cells.
  if(amount<.004){gl_FragColor=vec4(live,1.);return;}
  vec2 screen=vUv/uPixel,cell=floor(screen/vec2(6.,3.));
  float tick=floor(uTime*24.),block=hash(vec2(floor(cell.x/3.),cell.y)+tick);
  float run=hash(vec2(floor(cell.x/2.),floor(uTime*12.)));
  vec2 direction=(field.gb*255.-128.)/100.;
  vec2 shift=uPixel*(direction*(3.+block*12.)+vec2((block-.5)*20.,step(.65,run)*(run-.5)*42.))*amount;
  vec2 source=vUv-shift;
  source.x=mix(source.x,(floor(source.x/uPixel.x/4.)+.5)*uPixel.x*4.,step(.60,block));
  vec3 warped=cameraAt(source);
  vec3 split=vec3(cameraAt(source+uPixel*vec2(3.,0.)).r,warped.g,cameraAt(source-uPixel*vec2(3.,0.)).b);
  vec3 old=texture2D(uHistory,clamp(vUv-shift*.35,.001,.999)).rgb;
  vec3 color=palette(hash(vec2(floor(cell.x/2.),floor(cell.y/2.))+floor(uTime*9.)));
  vec3 corrupted=mix(split,color*(.25+mono(warped)*.95),.68);
  corrupted=mix(corrupted,old,uHistoryReady*(.35+block*.43));
  float scan=hash(cell+tick*3.);
  corrupted=mix(corrupted,color*(.45+scan*.65),step(.79,scan)*.75);
  corrupted=mix(corrupted,vec3(.025),step(.94,block)*.6);
  float flicker=.74+.26*step(.28,hash(cell+tick));
  gl_FragColor=vec4(mix(live,clamp(corrupted,0.,1.),amount*flicker),1.);
}`
export class ParticleRenderer{
  readonly renderer:THREE.WebGLRenderer
  readonly engine:FingertipDatamosh
  private camera=new THREE.Camera()
  private scene=new THREE.Scene()
  private quad:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>
  private material:THREE.ShaderMaterial
  private plain:THREE.ShaderMaterial
  private videoTexture:THREE.VideoTexture
  private history:THREE.WebGLRenderTarget[]
  private maskCanvas=document.createElement('canvas')
  private maskContext:CanvasRenderingContext2D
  private maskTexture:THREE.CanvasTexture
  private field:THREE.DataTexture
  private historyReady=false
  private fieldVersion=-1
  private faceVersion=-1
  private disposed=false
  ready=false
  constructor(canvas:HTMLCanvasElement,video:HTMLVideoElement,engine:FingertipDatamosh){
    this.engine=engine
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'})
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.autoClear=false;this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace
    this.videoTexture=new THREE.VideoTexture(video);this.videoTexture.colorSpace=THREE.NoColorSpace
    this.history=[0,1].map(()=>new THREE.WebGLRenderTarget(512,512,{depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter}))
    this.maskCanvas.width=this.maskCanvas.height=256;this.maskContext=this.maskCanvas.getContext('2d')!
    this.maskTexture=new THREE.CanvasTexture(this.maskCanvas)
    this.field=new THREE.DataTexture(engine.field,engine.columns,engine.rows,THREE.RGBAFormat,THREE.UnsignedByteType)
    this.field.magFilter=this.field.minFilter=THREE.NearestFilter;this.field.needsUpdate=true
    const uniforms={uVideo:{value:this.videoTexture},uCover:{value:new THREE.Vector2(1,1)},uReady:{value:0}}
    this.plain=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:plainFragment,depthTest:false,depthWrite:false,uniforms})
    this.material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:glitchFragment,depthTest:false,depthWrite:false,uniforms:{...uniforms,uHistory:{value:null},uMask:{value:this.maskTexture},uField:{value:this.field},uFace:{value:new THREE.Vector4(0,0,1,1)},uPixel:{value:new THREE.Vector2(1/innerWidth,1/innerHeight)},uTime:{value:0},uHistoryReady:{value:0}}})
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.plain);this.scene.add(this.quad);this.resize()
  }
  resize(){
    this.renderer.setSize(innerWidth,innerHeight,false)
    const scale=Math.min(1,1024/innerWidth,1200/innerHeight)
    this.history.forEach(t=>t.setSize(Math.max(1,Math.round(innerWidth*scale)),Math.max(1,Math.round(innerHeight*scale))))
    this.material.uniforms.uPixel!.value.set(1/innerWidth,1/innerHeight);this.invalidate()
  }
  invalidate(){this.historyReady=false;this.faceVersion=-1}
  private updateMask(){
    const face=this.engine.face,ctx=this.maskContext;ctx.clearRect(0,0,256,256)
    if(face){ctx.fillStyle='#fff';ctx.beginPath();face.contour.forEach((p,i)=>{const x=(p.x-face.x)/face.width*256,y=(1-(p.y-face.y)/face.height)*256;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.closePath();ctx.fill()}
    this.maskTexture.needsUpdate=true;this.faceVersion=this.engine.faceVersion
  }
  render(videoAspect:number){
    if(this.disposed)return
    const engine=this.engine,scale=coverScale(videoAspect,innerWidth/innerHeight),u=this.material.uniforms
    u.uCover!.value.set(scale.x,scale.y);u.uReady!.value=Number(this.ready)
    if(!this.ready||!engine.face||engine.stage==='idle'){
      this.historyReady=false;this.quad.material=this.plain
      this.renderer.setRenderTarget(null);this.renderer.clear();this.renderer.render(this.scene,this.camera);return
    }
    if(this.faceVersion!==engine.faceVersion)this.updateMask()
    if(this.fieldVersion!==engine.version){this.field.needsUpdate=true;this.fieldVersion=engine.version}
    const face=engine.face;u.uFace!.value.set(face.x,face.y,face.width,face.height)
    u.uTime!.value=engine.time;u.uHistory!.value=this.history[0]!.texture;u.uHistoryReady!.value=Number(this.historyReady)
    this.quad.material=this.material
    this.renderer.setRenderTarget(this.history[1]!);this.renderer.clear();this.renderer.render(this.scene,this.camera)
    this.renderer.setRenderTarget(null);this.renderer.clear();this.renderer.render(this.scene,this.camera)
    this.history.reverse();this.historyReady=true
  }
  dispose(){this.disposed=true;this.videoTexture.dispose();this.history.forEach(t=>t.dispose());this.maskTexture.dispose();this.field.dispose();this.material.dispose();this.plain.dispose();this.quad.geometry.dispose();this.renderer.dispose()}
}
