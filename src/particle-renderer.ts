import * as THREE from 'three'
import {FingertipDatamosh,GLITCH_GLYPHS} from './particle-engine'
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
uniform sampler2D uHistory,uField,uGlyphs;
uniform vec2 uPixel;
uniform float uTime,uHistoryReady;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 palette(float n){
  if(n<.18)return vec3(1.,.025,.55);
  if(n<.36)return vec3(.025,.94,1.);
  if(n<.52)return vec3(1.,.91,.025);
  if(n<.68)return vec3(.53,.065,1.);
  if(n<.83)return vec3(1.,.06,.11);
  return vec3(.14,1.,.08);
}
float codeGlyph(vec2 screen,float tick){
  vec2 tile=floor(screen/vec2(10.,16.)),uv=fract(screen/vec2(10.,16.));
  float col=mod(tile.x,12.),group=floor(tile.x/12.);
  float prefix=hash(vec2(group,tile.y));
  float index=floor(hash(tile+floor(tick/3.))*16.);
  // Legible ERR / MEM / CRC prefixes followed by changing hexadecimal payloads.
  if(col<3.){
    if(prefix<.34)index=col<1.?14.:27.;
    else if(prefix<.67)index=col>0.5&&col<1.5?14.:22.;
    else index=col>0.5&&col<1.5?27.:12.;
  }
  if(col>3.5&&col<4.5)index=0.;
  if(col>4.5&&col<5.5)index=36.;
  vec2 atlas=(vec2(mod(index,16.),2.-floor(index/16.))+uv)/vec2(16.,3.);
  return texture2D(uGlyphs,atlas).r*(1.-step(2.5,col)*step(col,3.5));
}
void main(){
  vec3 live=vec3(mono(cameraAt(vUv)));
  vec4 field=texture2D(uField,vUv);
  float strength=field.r;
  if(strength<.004){gl_FragColor=vec4(live,1.);return;}
  vec2 screen=vUv/uPixel;
  float tick=floor(uTime*30.);
  vec2 macro=floor(screen/vec2(26.,13.));
  vec2 band=vec2(floor(screen.x/90.),floor(screen.y/3.));
  float block=hash(macro+floor(tick/3.));
  float tear=hash(vec2(floor(screen.y/5.),tick));
  float vertical=hash(vec2(floor(screen.x/18.),floor(tick/2.)));
  vec2 direction=(field.gb*255.-128.)/100.;
  // Large jumps and repeated macroblocks destroy the source image inside the expanded trail.
  vec2 shift=uPixel*(direction*(18.+block*86.)+vec2((tear-.5)*190.,step(.63,vertical)*(vertical-.5)*110.));
  vec2 source=vUv-shift;
  vec2 quant=vec2(8.+floor(block*4.)*9.,5.+floor(vertical*5.)*8.);
  source=mix(source,(floor(source/uPixel/quant)+.5)*uPixel*quant,.84);
  vec3 warped=cameraAt(source);
  float separation=9.+block*24.;
  vec3 split=vec3(cameraAt(source+uPixel*vec2(separation,0.)).r,warped.g,cameraAt(source-uPixel*vec2(separation,0.)).b);
  float luma=mono(warped);
  vec3 color=palette(hash(macro+floor(tick/4.)));
  vec3 corrupted=mix(split,color*(.50+luma*.80),.87);
  vec3 old=texture2D(uHistory,clamp(vUv-shift*.45,.001,.999)).rgb;
  corrupted=mix(corrupted,old,uHistoryReady*(.16+block*.26));
  corrupted=floor(corrupted*6.)/6.;
  float stripe=hash(band+tick);
  corrupted=mix(corrupted,palette(stripe)*(1.1+stripe*.4),step(.69,stripe)*.9);
  corrupted=mix(corrupted,vec3(.012,.005,.025),step(.87,block)*.90);
  float noise=hash(floor(screen)+tick*7.);
  corrupted+=palette(noise)*step(.83,noise)*.30;
  float scanline=.68+.32*step(1.,mod(screen.y,3.));
  corrupted*=scanline;
  // Bright, stretched RGB scan bursts, like a corrupted display signal.
  float burst=step(.94,tear)*(0.65+0.35*hash(vec2(floor(screen.x/120.),tick)));
  corrupted+=vec3(.50,.80,1.)*burst*.85;
  vec2 codeTile=floor(screen/vec2(10.,16.));
  float codeRow=step(.22,hash(vec2(floor(codeTile.x/12.),codeTile.y)));
  float glyph=codeGlyph(screen,tick)*codeRow;
  corrupted*=1.-codeRow*.32;
  vec3 ink=mix(vec3(.3,1.,1.),vec3(1.,1.,.65),step(.55,hash(codeTile)));
  corrupted=mix(corrupted,ink,glyph);
  // Fully corrupted core; only the outer rim and the final recovery blend with the live camera.
  float amount=smoothstep(.015,.42,strength);
  gl_FragColor=vec4(mix(live,clamp(corrupted,0.,1.),amount),1.);
}`
function glyphAtlas(){
  const canvas=document.createElement('canvas');canvas.width=16*16;canvas.height=3*24
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height)
  ctx.font='bold 19px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff'
  for(let i=0;i<GLITCH_GLYPHS.length;i++)ctx.fillText(GLITCH_GLYPHS[i]!,i%16*16+8,Math.floor(i/16)*24+12)
  const texture=new THREE.CanvasTexture(canvas);texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter
  return texture
}
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
  private glyphs=glyphAtlas()
  private field:THREE.DataTexture
  private historyReady=false
  private fieldVersion=-1
  private disposed=false
  ready=false
  constructor(canvas:HTMLCanvasElement,video:HTMLVideoElement,engine:FingertipDatamosh){
    this.engine=engine
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'})
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.autoClear=false;this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace
    this.videoTexture=new THREE.VideoTexture(video);this.videoTexture.colorSpace=THREE.NoColorSpace
    this.history=[0,1].map(()=>new THREE.WebGLRenderTarget(512,512,{depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter}))
    this.field=new THREE.DataTexture(engine.field,engine.columns,engine.rows,THREE.RGBAFormat,THREE.UnsignedByteType)
    this.field.magFilter=this.field.minFilter=THREE.LinearFilter;this.field.needsUpdate=true
    const uniforms={uVideo:{value:this.videoTexture},uCover:{value:new THREE.Vector2(1,1)},uReady:{value:0}}
    this.plain=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:plainFragment,depthTest:false,depthWrite:false,uniforms})
    this.material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:glitchFragment,depthTest:false,depthWrite:false,uniforms:{...uniforms,uHistory:{value:null},uField:{value:this.field},uGlyphs:{value:this.glyphs},uPixel:{value:new THREE.Vector2(1/innerWidth,1/innerHeight)},uTime:{value:0},uHistoryReady:{value:0}}})
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.plain);this.scene.add(this.quad);this.resize()
  }
  resize(){
    this.renderer.setSize(innerWidth,innerHeight,false)
    const scale=Math.min(1,1024/innerWidth,1200/innerHeight)
    this.history.forEach(t=>t.setSize(Math.max(1,Math.round(innerWidth*scale)),Math.max(1,Math.round(innerHeight*scale))))
    this.material.uniforms.uPixel!.value.set(1/innerWidth,1/innerHeight);this.invalidate()
  }
  invalidate(){this.historyReady=false}
  render(videoAspect:number){
    if(this.disposed)return
    const engine=this.engine,scale=coverScale(videoAspect,innerWidth/innerHeight),u=this.material.uniforms
    u.uCover!.value.set(scale.x,scale.y);u.uReady!.value=Number(this.ready)
    if(!this.ready||engine.stage==='idle'){
      this.historyReady=false;this.quad.material=this.plain
      this.renderer.setRenderTarget(null);this.renderer.clear();this.renderer.render(this.scene,this.camera);return
    }
    if(this.fieldVersion!==engine.version){this.field.needsUpdate=true;this.fieldVersion=engine.version}
    u.uTime!.value=engine.time;u.uHistory!.value=this.history[0]!.texture;u.uHistoryReady!.value=Number(this.historyReady)
    this.quad.material=this.material
    this.renderer.setRenderTarget(this.history[1]!);this.renderer.clear();this.renderer.render(this.scene,this.camera)
    this.renderer.setRenderTarget(null);this.renderer.clear();this.renderer.render(this.scene,this.camera)
    this.history.reverse();this.historyReady=true
  }
  dispose(){this.disposed=true;this.videoTexture.dispose();this.history.forEach(t=>t.dispose());this.glyphs.dispose();this.field.dispose();this.material.dispose();this.plain.dispose();this.quad.geometry.dispose();this.renderer.dispose()}
}
