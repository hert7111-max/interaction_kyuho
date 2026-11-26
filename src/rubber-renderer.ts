import * as THREE from 'three'
import {RubberFace,FACE_OVAL,pickTriangle} from './rubber-engine'
import type {Point} from './rubber-engine'
import {coverScale} from './water-math'
const vertex=`varying vec2 vUv;varying float vEdge;attribute float edge;void main(){vUv=uv;vEdge=edge;gl_Position=vec4(position.xy,0.,1.);}`
const fragment=`precision highp float;
varying vec2 vUv;varying float vEdge;
uniform sampler2D uVideo;uniform vec2 uCover,uCheek0,uCheek1;uniform vec3 uTint0,uTint1;uniform float uMode,uReady;
vec2 camera(vec2 p){p=(p-.5)*uCover+.5;p.x=1.-p.x;return clamp(p,.001,.999);}
void main(){
 if(uReady<.5){gl_FragColor=vec4(vec3(.018),1.);return;}
 if(uMode<.5){gl_FragColor=texture2D(uVideo,camera(vUv));return;}
 float alpha=1.-smoothstep(.985,1.,vEdge);
 if(uMode<1.5){vec3 color=mix(uTint0,uTint1,smoothstep(uCheek0.x,uCheek1.x,vUv.x));gl_FragColor=vec4(color,alpha);}
 else gl_FragColor=vec4(texture2D(uVideo,camera(vUv)).rgb,alpha);
}`
const segments=160,rings=48,count=1+segments*rings
function spline(points:Point[],t:number){const n=points.length,i=Math.floor(t)%n,f=t-Math.floor(t),a=points[(i+n-1)%n]!,b=points[i]!,c=points[(i+1)%n]!,d=points[(i+2)%n]!;const axis=(k:'x'|'y')=>.5*(2*b[k]+(-a[k]+c[k])*f+(2*a[k]-5*b[k]+4*c[k]-d[k])*f*f+(-a[k]+3*b[k]-3*c[k]+d[k])*f*f*f);return{x:axis('x'),y:axis('y')}}
export class RubberRenderer{
  private renderer:THREE.WebGLRenderer
  private scene=new THREE.Scene()
  private camera=new THREE.Camera()
  private videoTexture:THREE.VideoTexture
  private cheekCanvas=document.createElement('canvas')
  private cheekContext:CanvasRenderingContext2D
  private uniforms:THREE.ShaderMaterial['uniforms']
  private materials:THREE.ShaderMaterial[]=[]
  private background:THREE.Mesh
  private mask:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>
  private skin:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>
  private rest=new Float32Array(count*2)
  private positions=new Float32Array(count*3)
  private bounds={x:0,y:0,width:1,height:1}
  private face:Point[]=[]
  private cheekValid=false
  ready=false
  private video:HTMLVideoElement
  readonly engine:RubberFace
  constructor(canvas:HTMLCanvasElement,video:HTMLVideoElement,engine:RubberFace){
    this.video=video;this.engine=engine
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace
    this.videoTexture=new THREE.VideoTexture(video);this.videoTexture.colorSpace=THREE.NoColorSpace
    this.cheekCanvas.width=16;this.cheekCanvas.height=8;this.cheekContext=this.cheekCanvas.getContext('2d',{willReadFrequently:true})!
    this.uniforms={uVideo:{value:this.videoTexture},uCover:{value:new THREE.Vector2(1,1)},uCheek0:{value:new THREE.Vector2(.4,.5)},uCheek1:{value:new THREE.Vector2(.6,.5)},uTint0:{value:new THREE.Vector3(.6,.4,.3)},uTint1:{value:new THREE.Vector3(.6,.4,.3)},uReady:{value:0}}
    const material=(mode:number)=>{const m=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{...this.uniforms,uMode:{value:mode}},transparent:mode>0,depthTest:false,depthWrite:false,side:THREE.DoubleSide});this.materials.push(m);return m}
    const bg=new THREE.PlaneGeometry(2,2);bg.setAttribute('edge',new THREE.BufferAttribute(new Float32Array(4),1));this.background=new THREE.Mesh(bg,material(0));this.background.renderOrder=0;this.scene.add(this.background)
    const indices:number[]=[],edge=new Float32Array(count)
    for(let r=1;r<=rings;r++)for(let s=0;s<segments;s++){
      const i=1+(r-1)*segments+s,next=1+(r-1)*segments+(s+1)%segments;edge[i]=r/rings
      if(r===1)indices.push(0,i,next)
      else{const prev=i-segments,pnext=next-segments;indices.push(prev,i,next,prev,next,pnext)}
    }
    const geometry=()=>{const g=new THREE.BufferGeometry();g.setIndex(indices);g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(count*2),2));g.setAttribute('edge',new THREE.BufferAttribute(edge,1));return g}
    this.mask=new THREE.Mesh(geometry(),material(1));this.skin=new THREE.Mesh(geometry(),material(2));this.skin.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));this.mask.renderOrder=1;this.skin.renderOrder=2;this.mask.frustumCulled=this.skin.frustumCulled=false;this.scene.add(this.mask,this.skin);this.resize()
  }
  resize(){this.renderer.setSize(innerWidth,innerHeight,false)}
  invalidate(){this.cheekValid=false;this.face=[];this.skin.visible=this.mask.visible=false}
  local(p:Point):Point{const b=this.bounds;return{x:(p.x-b.x)/b.width,y:(p.y-b.y)/b.height}}
  setFace(face:Point[]){
    if(face.length<468){this.face=[];this.engine.reset();return}
    this.face=face
    const oval=FACE_OVAL.map(i=>face[i]!),xs=oval.map(p=>p.x),ys=oval.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y
    if(width<.015||height<.015){this.face=[];this.engine.reset();return}
    this.bounds={x,y,width,height};this.engine.aspect=width*innerWidth/(height*innerHeight)
    const contour=oval.map(p=>this.local(p)),center=contour.reduce((sum,p)=>({x:sum.x+p.x/contour.length,y:sum.y+p.y/contour.length}),{x:0,y:0})
    this.rest[0]=center.x;this.rest[1]=center.y
    for(let s=0;s<segments;s++){const edge=spline(contour,s/segments*contour.length);for(let r=1;r<=rings;r++){const i=(1+(r-1)*segments+s)*2;this.rest[i]=center.x+(edge.x-center.x)*r/rings;this.rest[i+1]=center.y+(edge.y-center.y)*r/rings}}
    const cheeks=[face[205]!,face[425]!].sort((a,b)=>a.x-b.x);this.uniforms.uCheek0!.value.set(cheeks[0]!.x,cheeks[0]!.y);this.uniforms.uCheek1!.value.set(cheeks[1]!.x,cheeks[1]!.y)
    if(this.video.readyState>=2&&!this.engine.handles.size){
      const scale=coverScale(this.video.videoWidth/this.video.videoHeight,innerWidth/innerHeight),vw=this.video.videoWidth,vh=this.video.videoHeight,size=Math.max(3,height*scale.y*vh*.035)
      for(let i=0;i<2;i++){const p=cheeks[i]!,sx=(1-((p.x-.5)*scale.x+.5))*vw,sy=(1-((p.y-.5)*scale.y+.5))*vh;this.cheekContext.drawImage(this.video,sx-size/2,sy-size/2,size,size,i*8,0,8,8)}
      const pixels=this.cheekContext.getImageData(0,0,16,8).data
      for(let side=0;side<2;side++){let r=0,g=0,b=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const k=(y*16+x+side*8)*4;r+=pixels[k]!;g+=pixels[k+1]!;b+=pixels[k+2]!}this.uniforms[side?'uTint1':'uTint0']!.value.lerp(new THREE.Vector3(r/(64*255),g/(64*255),b/(64*255)),this.cheekValid ? .4 : 1)}
      this.cheekValid=true
    }
  }
  pick(p:Point):Point|null{
    if(!this.face.length)return null
    const index=this.skin.geometry.index!,b=this.bounds
    const point=(i:number)=>({x:((this.positions[i*3]!+1)/2-b.x)/b.width,y:((this.positions[i*3+1]!+1)/2-b.y)/b.height})
    for(let t=index.count-3;t>=0;t-=3){const a=index.getX(t),c=index.getX(t+1),d=index.getX(t+2),weights=pickTriangle(p,point(a),point(c),point(d));if(weights)return{x:this.rest[a*2]!*weights[0]!+this.rest[c*2]!*weights[1]!+this.rest[d*2]!*weights[2]!,y:this.rest[a*2+1]!*weights[0]!+this.rest[c*2+1]!*weights[1]!+this.rest[d*2+1]!*weights[2]!}}
    return null
  }
  render(videoAspect:number){
    const scale=coverScale(videoAspect,innerWidth/innerHeight);this.uniforms.uCover!.value.set(scale.x,scale.y);this.uniforms.uReady!.value=Number(this.ready)
    const deforming=this.engine.handles.size>0
    // Both layers sample the same live camera texture and the same cover/mirror mapping.
    // At rest show the original camera directly; only an actual pull needs a skin-color backing.
    const visible=this.ready&&this.face.length>0&&this.video.readyState>=2
    this.skin.visible=visible&&deforming
    this.mask.visible=this.skin.visible&&this.cheekValid
    if(visible){
      const b=this.bounds,mask=this.mask.geometry.getAttribute('position'),uv=this.skin.geometry.getAttribute('uv'),maskUV=this.mask.geometry.getAttribute('uv')
      for(let i=0;i<count;i++){
        const rest={x:this.rest[i*2]!,y:this.rest[i*2+1]!},p=this.engine.deform(rest),u=b.x+rest.x*b.width,v=b.y+rest.y*b.height
        this.positions[i*3]=(b.x+p.x*b.width)*2-1;this.positions[i*3+1]=(b.y+p.y*b.height)*2-1
        mask.setXYZ(i,(b.x+rest.x*b.width)*2-1,(b.y+rest.y*b.height)*2-1,0)
        uv.setXY(i,u,v)
        maskUV.setXY(i,u,v)
      }
      this.skin.geometry.getAttribute('position').needsUpdate=true;mask.needsUpdate=uv.needsUpdate=maskUV.needsUpdate=true
    }
    this.renderer.render(this.scene,this.camera)
  }
  dispose(){this.videoTexture.dispose();for(const m of this.materials)m.dispose();this.background.geometry.dispose();this.mask.geometry.dispose();this.skin.geometry.dispose();this.renderer.dispose()}
}
