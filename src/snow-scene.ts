import { FogField, HumanField, SnowWorld } from './snow-physics'
import type { Vec } from './snow-physics'
import { coverScale } from './water-math'
export type Cloud={id:number;seed:number;baseX:number;baseY:number;x:number;y:number;width:number;activeUntil:number;pulse:number;emission:number}
export type IndexTip=Vec&{id:string}
export type Mouth=Vec&{width:number;open:boolean}
export class SnowScene {
  world:SnowWorld
  human:HumanField
  fog:FogField
  clouds:Cloud[]=[]
  tips:IndexTip[]=[]
  mouth:Mouth|null=null
  mirror=true
  showContour=false
  live=false
  demo=false
  breathing=false
  paused=false
  density=.65
  time=0
  lastHumanAt=0
  lastTrackingAt=0
  onCloud:((id:number)=>void)|null=null
  private width=1
  private height=1
  private ctx:CanvasRenderingContext2D
  private fogCtx:CanvasRenderingContext2D
  private fogMask=document.createElement('canvas')
  private maskCtx:CanvasRenderingContext2D
  private fogImage:ImageData
  private previousTips=new Map<string,Vec>()
  private cloudSprite=document.createElement('canvas')
  private pointer:Vec|null=null
  private previousPointer:Vec|null=null
  private contourCanvas=document.createElement('canvas')
  private contourImage:ImageData
  private contourCtx:CanvasRenderingContext2D
  private statsTimer=0
  settled=0
  private canvas:HTMLCanvasElement
  private fogCanvas:HTMLCanvasElement
  private video:HTMLVideoElement
  constructor(canvas:HTMLCanvasElement,fogCanvas:HTMLCanvasElement,video:HTMLVideoElement){
    this.canvas=canvas;this.fogCanvas=fogCanvas;this.video=video
    this.ctx=canvas.getContext('2d')!;this.fogCtx=fogCanvas.getContext('2d')!
    this.maskCtx=this.fogMask.getContext('2d')!;this.contourCtx=this.contourCanvas.getContext('2d')!
    this.world=new SnowWorld(1600);this.human=new HumanField(1600);this.fog=new FogField(16/9)
    this.fogImage=new ImageData(this.fog.width,this.fog.height);this.contourImage=new ImageData(this.human.width,this.human.height)
    this.makeCloud();this.resize()
  }
  get worldWidth(){return this.world.width}
  get snowing(){return this.world.particles.some(p=>!p.settled)||this.clouds.some(c=>c.activeUntil>this.time)}
  resize(){
    this.width=innerWidth;this.height=innerHeight
    const dpr=Math.min(devicePixelRatio,1.6)
    this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr)
    this.ctx.setTransform(this.height/900*dpr,0,0,this.height/900*dpr,0,0)
    this.world=new SnowWorld(this.width/this.height*900)
    this.human=new HumanField(this.world.width);this.fog=new FogField(this.width/this.height)
    this.fogMask.width=this.fog.width;this.fogMask.height=this.fog.height
    this.fogCanvas.width=this.fog.width*2;this.fogCanvas.height=this.fog.height*2
    this.fogImage=this.maskCtx.createImageData(this.fog.width,this.fog.height)
    this.contourCanvas.width=this.human.width;this.contourCanvas.height=this.human.height
    this.contourImage=this.contourCtx.createImageData(this.human.width,this.human.height)
    this.previousTips.clear();this.tips=[]
    const count=this.width<700?3:5
    this.clouds=Array.from({length:count},(_,i)=>({id:i,seed:i*2.41+1,baseX:(i+.5)/count,baseY:(this.width<700?.235:.22)+(i%2)*.065,x:0,y:0,width:this.width<700?130:175+(i%3)*22,activeUntil:0,pulse:0,emission:0}))
    this.updateClouds(0)
    if(this.demo)this.demoBody()
  }
  clear(){this.world.clear();this.fog.clear();this.clouds.forEach(c=>{c.activeUntil=0;c.emission=0;c.pulse=0})}
  resetTracking(){this.tips=[];this.mouth=null;this.previousTips.clear();this.lastTrackingAt=0;this.lastHumanAt=0;this.human.clear()}
  setMask(mask:Float32Array,width:number,height:number,aspect:number){this.human.update(mask,width,height,aspect,this.mirror);this.lastHumanAt=performance.now()}
  setTips(tips:IndexTip[]){this.tips=tips;this.lastTrackingAt=performance.now()}
  setPointer(point:Vec|null){this.pointer=point;if(!point)this.previousPointer=null}
  poke(point:Vec){
    for(const cloud of this.clouds)if(this.insideCloud(point,cloud))this.activate(cloud)
  }
  private insideCloud(point:Vec,cloud:Cloud){return Math.hypot((point.x-cloud.x)/(cloud.width*.49),(point.y-cloud.y)/(cloud.width*.25))<1.12}
  private activate(cloud:Cloud){
    if(this.time<cloud.activeUntil-5.1)return
    const first=this.time>cloud.activeUntil
    cloud.activeUntil=this.time+6;cloud.pulse=1
    if(first){this.world.spawn(cloud.x,cloud.y+cloud.width*.13,cloud.width*.75,10);this.onCloud?.(cloud.id)}
  }
  private updateClouds(dt:number){
    const w=this.world.width
    for(const cloud of this.clouds){
      cloud.x=cloud.baseX*w+Math.sin(this.time*.11+cloud.seed)*Math.min(w*.055,80)
      cloud.y=cloud.baseY*900+Math.sin(this.time*.24+cloud.seed)*11
      cloud.pulse=Math.max(0,cloud.pulse-dt*1.2)
      if(cloud.activeUntil>this.time){
        cloud.emission+=dt*(18+this.density*48)
        const count=Math.floor(cloud.emission);cloud.emission-=count
        this.world.spawn(cloud.x,cloud.y+cloud.width*.14,cloud.width*.85,count)
      }
    }
  }
  update(dt:number,now:number){
    if(this.paused)return
    dt=Math.min(dt,.06);this.time+=dt;this.updateClouds(dt)
    if(this.live&&now-this.lastTrackingAt>420){this.tips=[];this.mouth=null;this.previousTips.clear()}
    if(this.live&&now-this.lastHumanAt>650)this.human.clear()
    this.fog.decay(dt)
    if(this.snowing&&((this.mouth?.open&&this.live)||this.breathing)){
      const mouth=this.mouth??{x:this.world.width*.5,y:425,width:65,open:true}
      const radius=Math.max(85,Math.min(185,mouth.width*2.7))
      this.fog.breathe(mouth.x/this.world.width,(mouth.y-12)/900,radius/this.world.width,radius*.72/900,dt*2.4)
    }
    const seen=new Set<string>()
    for(const tip of this.tips){
      const point={x:tip.x,y:tip.y},last=this.previousTips.get(tip.id)??point
      // Do not join two unrelated tracks after a hand disappears or crosses the frame.
      const from=Math.hypot(point.x-last.x,point.y-last.y)>150?point:last
      for(const cloud of this.clouds)if(this.insideCloud(point,cloud))this.activate(cloud)
      this.fog.erase({x:from.x/this.world.width,y:from.y/900},{x:point.x/this.world.width,y:point.y/900},.023)
      this.previousTips.set(tip.id,point);seen.add(tip.id)
    }
    for(const id of this.previousTips.keys())if(!seen.has(id))this.previousTips.delete(id)
    if(this.demo&&this.pointer){
      this.poke(this.pointer)
      const last=this.previousPointer??this.pointer
      this.fog.erase({x:last.x/this.world.width,y:last.y/900},{x:this.pointer.x/this.world.width,y:this.pointer.y/900},.026)
      this.previousPointer={...this.pointer}
    }
    this.world.update(dt,this.human)
    this.statsTimer+=dt
    if(this.statsTimer>.25){this.settled=this.world.particles.filter(p=>p.settled).length;this.statsTimer=0}
  }
  render(){
    const ctx=this.ctx,w=this.world.width
    ctx.clearRect(0,0,w,900)
    if(this.demo)this.drawDemoBody(ctx)
    if(this.showContour&&this.human.hasPerson){
      const data=this.contourImage.data,m=this.human.mask
      for(let i=0;i<m.length;i++){data[i*4]=142;data[i*4+1]=215;data[i*4+2]=234;data[i*4+3]=m[i]?30:0}
      this.contourCtx.putImageData(this.contourImage,0,0)
      ctx.drawImage(this.contourCanvas,0,0,w,900)
    }
    for(const cloud of this.clouds){
      const scale=1+Math.sin(this.time*3+cloud.seed)*.008+cloud.pulse*.035
      const cw=cloud.width*scale,ch=cw*.61
      ctx.save();ctx.globalAlpha=(this.live||this.demo) ? .94 : .76
      ctx.shadowColor=cloud.activeUntil>this.time?'#cbeeff88':'#b6d8fb26';ctx.shadowBlur=cloud.activeUntil>this.time?22:10
      ctx.drawImage(this.cloudSprite,cloud.x-cw*.5,cloud.y-ch*.5,cw,ch)
      ctx.restore()
      if(cloud.activeUntil>this.time){ctx.beginPath();ctx.ellipse(cloud.x,cloud.y+ch*.21,cw*.27,ch*.075,0,0,Math.PI*2);ctx.strokeStyle='#d8f5ff6b';ctx.lineWidth=.8;ctx.stroke()}
    }
    ctx.save()
    for(const p of this.world.particles){
      const fade=Math.min(1,(p.life-p.age)/4)
      ctx.globalAlpha=fade*(p.settled ? .95 : .7+Math.sin(p.phase+p.age)*.15)
      ctx.fillStyle=p.settled?'#f5fbff':'#e6f5ff'
      ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill()
      if(!p.settled&&p.radius>2.8){
        ctx.strokeStyle='#eaf8ffb0';ctx.lineWidth=.7;ctx.beginPath()
        const r=p.radius*1.6
        for(let i=0;i<3;i++){const angle=p.phase+this.time*.35+i*Math.PI/3,dx=Math.cos(angle)*r,dy=Math.sin(angle)*r;ctx.moveTo(p.x-dx,p.y-dy);ctx.lineTo(p.x+dx,p.y+dy)}ctx.stroke()
      }
    }
    ctx.restore()
    for(const tip of this.tips){ctx.beginPath();ctx.arc(tip.x,tip.y,6,0,Math.PI*2);ctx.strokeStyle='#e0f6ffb0';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(tip.x,tip.y,2,0,Math.PI*2);ctx.fillStyle='#d6f3ff';ctx.fill()}
    this.renderFog()
  }
  private renderFog(){
    const {width,height,density}=this.fog,data=this.fogImage.data
    for(let i=0;i<density.length;i++){data[i*4]=235;data[i*4+1]=245;data[i*4+2]=255;data[i*4+3]=Math.round(density[i]!*255)}
    this.maskCtx.putImageData(this.fogImage,0,0)
    const ctx=this.fogCtx,cw=this.fogCanvas.width,ch=this.fogCanvas.height
    ctx.clearRect(0,0,cw,ch)
    if(!density.some(value=>value>.005))return
    ctx.save()
    if(this.live&&this.video.readyState>=2){
      const scale=coverScale(this.video.videoWidth/this.video.videoHeight,this.width/this.height)
      const sw=this.video.videoWidth*scale.x,sh=this.video.videoHeight*scale.y
      ctx.filter='blur(8px)'
      if(this.mirror){ctx.translate(cw,0);ctx.scale(-1,1)}
      ctx.drawImage(this.video,(this.video.videoWidth-sw)/2,(this.video.videoHeight-sh)/2,sw,sh,-12,-12,cw+24,ch+24)
      ctx.setTransform(1,0,0,1,0,0);ctx.filter='none'
      ctx.fillStyle='#e5f1ff8c';ctx.fillRect(0,0,cw,ch)
    }else{ctx.fillStyle='#e3f1ff';ctx.fillRect(0,0,cw,ch)}
    ctx.globalCompositeOperation='destination-in'
    ctx.drawImage(this.fogMask,0,0,width,height,0,0,cw,ch)
    ctx.restore()
  }
  demoBody(){
    const mask=new Uint8Array(this.human.mask.length),w=this.human.width,h=this.human.height
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const wx=(x+.5)/w*this.world.width,wy=(y+.5)/h*900,cx=this.world.width*.5
      const head=((wx-cx)/66)**2+((wy-425)/83)**2<1
      const shoulders=((wx-cx)/Math.min(210,this.world.width*.37))**2+((wy-750)/210)**2<1
      const neck=Math.abs(wx-cx)<40&&wy>475&&wy<665
      mask[y*w+x]=Number(head||shoulders||neck)
    }
    this.human.setMask(mask)
  }
  private drawDemoBody(ctx:CanvasRenderingContext2D){
    const w=this.world.width,cx=w*.5
    ctx.save();ctx.fillStyle='#b7d0ea0b';ctx.strokeStyle='#bfdcf328';ctx.lineWidth=1.2
    ctx.beginPath();ctx.ellipse(cx,425,66,83,0,0,Math.PI*2);ctx.fill();ctx.stroke()
    ctx.beginPath();ctx.ellipse(cx,750,Math.min(210,w*.37),210,0,Math.PI,Math.PI*2);ctx.lineTo(cx+Math.min(210,w*.37),900);ctx.lineTo(cx-Math.min(210,w*.37),900);ctx.closePath();ctx.fill();ctx.stroke()
    ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillStyle='#b9d1e46b';ctx.fillText('체험용 윤곽',cx,665)
    ctx.restore()
  }
  private makeCloud(){
    const canvas=this.cloudSprite;canvas.width=480;canvas.height=290
    const ctx=canvas.getContext('2d')!
    const lobes=[[113,160,66],[178,137,82],[252,113,91],[322,143,72],[372,173,47],[220,182,85],[307,188,66]]
    ctx.save();ctx.filter='blur(2px)'
    for(const [x,y,r] of lobes){const g=ctx.createRadialGradient(x-r*.27,y-r*.45,0,x,y,r);g.addColorStop(0,'#fafcff');g.addColorStop(.48,'#e1edf6');g.addColorStop(.8,'#bdcfdf');g.addColorStop(.94,'#a8bdcfaa');g.addColorStop(1,'#9cb5c000');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x!,y!,r!,0,Math.PI*2);ctx.fill()}
    ctx.restore()
    ctx.globalCompositeOperation='source-atop'
    const shade=ctx.createLinearGradient(0,100,0,255);shade.addColorStop(0,'#daeaff00');shade.addColorStop(.72,'#6b809d26');shade.addColorStop(1,'#596e8d99');ctx.fillStyle=shade;ctx.fillRect(0,0,480,290)
  }
}
