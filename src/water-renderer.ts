import * as THREE from 'three'
import type { Point } from './water-math'
import { coverScale } from './water-math'
export type Touch = { from: Point; to: Point; strength: number }
const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`
const simulation = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uAspect, uDamping;
uniform vec4 uPaths[10];
uniform float uStrengths[10];
void main(){
  vec2 state=texture2D(uState,vUv).rg;
  float h=state.r;
  float lap=texture2D(uState,vUv+vec2(uTexel.x,0.)).r+texture2D(uState,vUv-vec2(uTexel.x,0.)).r+texture2D(uState,vUv+vec2(0.,uTexel.y)).r+texture2D(uState,vUv-vec2(0.,uTexel.y)).r-4.*h;
  float velocity=(state.g+lap*.22)*uDamping;
  for(int i=0;i<10;i++){
    vec2 p=vUv*vec2(uAspect,1.);
    vec2 a=uPaths[i].xy*vec2(uAspect,1.);
    vec2 b=uPaths[i].zw*vec2(uAspect,1.);
    vec2 ab=b-a;
    float t=clamp(dot(p-a,ab)/(dot(ab,ab)+.0000001),0.,1.);
    float d=length(p-a-t*ab);
    float wake=exp(-d*d/0.000045)-.32*exp(-d*d/0.0002);
    velocity+=wake*uStrengths[i];
  }
  h=clamp(h+velocity,-2.,2.);
  float edge=smoothstep(0.,.025,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
  gl_FragColor=vec4(h*edge,velocity*edge,0.,1.);
}`
const surface = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState,uCamera;
uniform vec2 uTexel,uCover;
uniform float uAspect,uTime,uCameraReady,uMirror,uIntensity;
vec3 backdrop(vec2 uv){
  vec2 p=(uv-.5)*vec2(uAspect,1.);
  float light=exp(-length(p-vec2(.2,.2))*2.4);
  float bands=sin(p.y*19.+sin(p.x*8.+uTime*.15)*1.8+uTime*.22);
  float caustic=pow(.5+.5*sin(p.x*17.+bands+uTime*.12),9.)*.05;
  return mix(vec3(.018,.055,.068),vec3(.075,.22,.25),light)+caustic;
}
void main(){
  float l=texture2D(uState,vUv-vec2(uTexel.x,0.)).r;
  float r=texture2D(uState,vUv+vec2(uTexel.x,0.)).r;
  float b=texture2D(uState,vUv-vec2(0.,uTexel.y)).r;
  float t=texture2D(uState,vUv+vec2(0.,uTexel.y)).r;
  vec2 slope=vec2(l-r,b-t);
  vec2 offset=slope*vec2(1./uAspect,1.)*.18*uIntensity;
  vec2 uv=clamp(vUv+offset,0.001,.999);
  vec2 cameraUV=(uv-.5)*uCover+.5;
  if(uMirror>.5)cameraUV.x=1.-cameraUV.x;
  vec3 color=uCameraReady>.5?texture2D(uCamera,cameraUV).rgb:backdrop(uv);
  vec3 normal=normalize(vec3(slope*3.,.65));
  float specular=pow(max(dot(normal,normalize(vec3(-.45,.65,1.))),0.),35.);
  color+=vec3(.65,.88,.91)*specular*.32*uIntensity;
  color+=clamp(slope.y*.16,-.09,.09)*uIntensity;
  float vignette=1.-.18*length((vUv-.5)*1.2);
  gl_FragColor=vec4(color*vignette,1.);
}`
export class WaterRenderer {
  readonly renderer: THREE.WebGLRenderer
  private camera = new THREE.Camera()
  private scene = new THREE.Scene()
  private simulation: THREE.ShaderMaterial
  private surface: THREE.ShaderMaterial
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private targets: THREE.WebGLRenderTarget[]
  private videoTexture: THREE.VideoTexture
  private pending: Touch[] = []
  private accumulator = 0
  private previousTime = 0
  aspect = 1
  intensity = 1
  persistence = .985
  mirror = true
  cameraReady = false
  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    if (!this.renderer.extensions.has('EXT_color_buffer_float')) throw new Error('물결 효과에 필요한 WebGL 기능을 사용할 수 없어요. 최신 Chrome 또는 Safari에서 열어주세요.')
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.videoTexture = new THREE.VideoTexture(video)
    this.videoTexture.colorSpace = THREE.NoColorSpace
    this.targets = [0,1].map(() => new THREE.WebGLRenderTarget(256,256,{ type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false }))
    this.simulation = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: simulation, uniforms: {
      uState:{value:null}, uTexel:{value:new THREE.Vector2(1/256,1/256)}, uAspect:{value:1}, uDamping:{value:.985},
      uPaths:{value:Array.from({length:10},()=>new THREE.Vector4())}, uStrengths:{value:new Float32Array(10)},
    } })
    this.surface = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: surface, uniforms: {
      uState:{value:null},uCamera:{value:this.videoTexture},uTexel:{value:new THREE.Vector2(1/256,1/256)},uCover:{value:new THREE.Vector2(1,1)},uAspect:{value:1},uTime:{value:0},uCameraReady:{value:0},uMirror:{value:1},uIntensity:{value:1},
    } })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.surface)
    this.scene.add(this.mesh)
    this.resize()
    this.clear()
  }
  resize() {
    this.aspect = innerWidth/innerHeight
    this.renderer.setSize(innerWidth,innerHeight,false)
    const height=256, width=Math.max(128,Math.min(768,Math.round(height*this.aspect)))
    this.targets.forEach(target=>target.setSize(width,height))
    this.simulation.uniforms.uTexel!.value.set(1/width,1/height)
    this.surface.uniforms.uTexel!.value.set(1/width,1/height)
    this.simulation.uniforms.uAspect!.value=this.aspect
    this.surface.uniforms.uAspect!.value=this.aspect
    this.clear()
  }
  disturb(touches: Touch[]) { this.pending=touches.slice(0,10) }
  clear() {
    this.pending=[]
    this.targets.forEach(target=>{this.renderer.setRenderTarget(target);this.renderer.setClearColor(0,0);this.renderer.clear()})
    this.renderer.setRenderTarget(null)
  }
  render(time: number, videoAspect: number) {
    this.accumulator+=Math.min((time-this.previousTime)/1000, .05)
    this.previousTime=time
    const u=this.simulation.uniforms
    while(this.accumulator>=1/60){
      u.uStrengths!.value.fill(0)
      this.pending.forEach((touch,index)=>{
        u.uPaths!.value[index].set(touch.from.x,touch.from.y,touch.to.x,touch.to.y)
        u.uStrengths!.value[index]=touch.strength
      })
      this.pending=[]
      u.uState!.value=this.targets[0]!.texture
      u.uDamping!.value=this.persistence
      this.mesh.material=this.simulation
      this.renderer.setRenderTarget(this.targets[1]!)
      this.renderer.render(this.scene,this.camera)
      this.targets.reverse()
      this.accumulator-=1/60
    }
    const scale=coverScale(videoAspect,this.aspect)
    this.surface.uniforms.uCover!.value.set(scale.x,scale.y)
    this.surface.uniforms.uState!.value=this.targets[0]!.texture
    this.surface.uniforms.uTime!.value=time/1000
    this.surface.uniforms.uCameraReady!.value=Number(this.cameraReady)
    this.surface.uniforms.uMirror!.value=Number(this.mirror)
    this.surface.uniforms.uIntensity!.value=this.intensity
    this.mesh.material=this.surface
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene,this.camera)
  }
  dispose() {
    this.videoTexture.dispose();this.targets.forEach(t=>t.dispose());this.simulation.dispose();this.surface.dispose();this.mesh.geometry.dispose();this.renderer.dispose()
  }
}
