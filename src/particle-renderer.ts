import * as THREE from 'three'
import {RubberSurface} from './particle-engine'
import {coverScale} from './water-math'
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`
const fragment=`
precision highp float;
varying vec2 vUv;
uniform sampler2D uVideo,uField;
uniform vec2 uCover,uGrid,uScreen;
uniform vec4 uGrip0,uGrip1;
uniform float uReady,uDeformed;
float ring(vec4 grip){
  float d=length((vUv-grip.xy)*uScreen);
  return (1.-smoothstep(.5,1.6,abs(d-8.)))*grip.z;
}
void main(){
  if(uReady<.5){gl_FragColor=vec4(vec3(.018),1.);return;}
  vec2 source=vUv;
  if(uDeformed>.5){
    vec2 texel=(vUv*(uGrid-1.)+.5)/uGrid;
    vec4 packedUV=texture2D(uField,texel);
    source=vec2(dot(packedUV.rg,vec2(256.,1.)),dot(packedUV.ba,vec2(256.,1.)))*(255./65535.);
  }
  vec2 p=(source-.5)*uCover+.5;p.x=1.-p.x;
  vec3 camera=texture2D(uVideo,clamp(p,.001,.999)).rgb;
  float luma=clamp((dot(camera,vec3(.2126,.7152,.0722))-.5)*1.08+.5,0.,1.);
  float grip=max(ring(uGrip0),ring(uGrip1));
  gl_FragColor=vec4(vec3(mix(luma,.95,grip*.8)),1.);
}`
export class ParticleRenderer{
  readonly renderer:THREE.WebGLRenderer
  readonly engine:RubberSurface
  private camera=new THREE.Camera()
  private scene=new THREE.Scene()
  private quad:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>
  private material:THREE.ShaderMaterial
  private videoTexture:THREE.VideoTexture
  private field:THREE.DataTexture
  private fieldVersion=-1
  private disposed=false
  ready=false
  constructor(canvas:HTMLCanvasElement,video:HTMLVideoElement,engine:RubberSurface){
    this.engine=engine
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'})
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace
    this.videoTexture=new THREE.VideoTexture(video);this.videoTexture.colorSpace=THREE.NoColorSpace
    // Two 16-bit source coordinates in RGBA8, supported without float texture extensions.
    this.field=new THREE.DataTexture(engine.field,engine.columns,engine.rows,THREE.RGBAFormat,THREE.UnsignedByteType)
    this.field.magFilter=this.field.minFilter=THREE.LinearFilter;this.field.needsUpdate=true
    this.material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,depthTest:false,depthWrite:false,uniforms:{uVideo:{value:this.videoTexture},uField:{value:this.field},uCover:{value:new THREE.Vector2(1,1)},uGrid:{value:new THREE.Vector2(engine.columns,engine.rows)},uScreen:{value:new THREE.Vector2(innerWidth,innerHeight)},uGrip0:{value:new THREE.Vector4(0,0,0,0)},uGrip1:{value:new THREE.Vector4(0,0,0,0)},uReady:{value:0},uDeformed:{value:0}}})
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.scene.add(this.quad);this.resize()
  }
  resize(){this.renderer.setSize(innerWidth,innerHeight,false);this.material.uniforms.uScreen!.value.set(innerWidth,innerHeight)}
  invalidate(){this.fieldVersion=-1}
  render(videoAspect:number){
    if(this.disposed)return
    const engine=this.engine,scale=coverScale(videoAspect,innerWidth/innerHeight),u=this.material.uniforms
    u.uCover!.value.set(scale.x,scale.y);u.uReady!.value=Number(this.ready);u.uDeformed!.value=Number(engine.deformed)
    if(this.fieldVersion!==engine.version){this.field.needsUpdate=true;this.fieldVersion=engine.version}
    u.uGrip0!.value.set(0,0,0,0);u.uGrip1!.value.set(0,0,0,0)
    let index=0;for(const grip of engine.grips.values()){u[index++?'uGrip1':'uGrip0']!.value.set(grip.point.x,grip.point.y,1,0)}
    this.renderer.render(this.scene,this.camera)
  }
  dispose(){this.disposed=true;this.videoTexture.dispose();this.field.dispose();this.material.dispose();this.quad.geometry.dispose();this.renderer.dispose()}
}
