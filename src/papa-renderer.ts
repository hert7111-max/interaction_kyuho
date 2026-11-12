import { PapaGame, RAINBOW } from './papa-game'
import type { Vec,Person } from './papa-game'
import { HumanSprites } from './papa-sprites'
export class PapaRenderer{
  private canvas:HTMLCanvasElement
  private ctx:CanvasRenderingContext2D
  private sprites=new HumanSprites()
  private ratio=1
  private smoke:HTMLCanvasElement
  private sourceGlow:HTMLCanvasElement
  private beamGlow:HTMLCanvasElement
  private sparks:HTMLCanvasElement[]
  eyes:Vec[][]=[]
  private displayedEyes:Vec[][]=[]
  glow=0
  constructor(canvas:HTMLCanvasElement){
    this.canvas=canvas;this.ctx=canvas.getContext('2d')!
    this.smoke=this.texture(96,96,ctx=>{const g=ctx.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,'#c8d5dd');g.addColorStop(.45,'#7e919c99');g.addColorStop(1,'#51667400');ctx.fillStyle=g;ctx.fillRect(0,0,96,96)})
    this.sourceGlow=this.texture(64,64,ctx=>{const g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fff');g.addColorStop(.2,'#e3edff');g.addColorStop(.42,'#dda6ff9c');g.addColorStop(1,'#a89aff00');ctx.fillStyle=g;ctx.fillRect(0,0,64,64)})
    this.sparks=RAINBOW.map(color=>this.texture(40,24,ctx=>{ctx.shadowColor=color;ctx.shadowBlur=7;ctx.fillStyle=color;ctx.fillRect(12,11,16,2)}))
    this.beamGlow=this.texture(128,64,ctx=>{ctx.lineCap='round';for(let i=0;i<7;i++){ctx.strokeStyle=RAINBOW[i]!;ctx.shadowColor=RAINBOW[i]!;ctx.shadowBlur=9;ctx.lineWidth=2.1;ctx.beginPath();ctx.moveTo(-10,32+(i-3)*1.7);ctx.lineTo(138,32+(i-3)*1.7);ctx.stroke()}})
    this.resize()
  }
  private texture(w:number,h:number,paint:(ctx:CanvasRenderingContext2D)=>void){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d')!);return canvas}
  resize(){const dpr=Math.min(devicePixelRatio,1.75);this.canvas.width=Math.round(innerWidth*dpr);this.canvas.height=Math.round(innerHeight*dpr);this.ratio=innerHeight/900*dpr;this.base();this.ctx.imageSmoothingEnabled=false}
  private base(){this.ctx.setTransform(this.ratio,0,0,this.ratio,0,0)}
  render(game:PapaGame,dt:number){
    const ctx=this.ctx,w=game.width,time=game.time
    this.base();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,w,900)
    const power=game.beams.length?1:0
    this.glow+=(power-this.glow)*(1-Math.exp(-dt*(power?26:16)))
    if(!this.eyes.length)this.displayedEyes.length=0
    else{
      const alpha=1-Math.exp(-dt*35)
      for(let e=0;e<this.eyes.length;e++){const source=this.eyes[e]!,target=this.displayedEyes[e]??(this.displayedEyes[e]=[]);for(let i=0;i<source.length;i++){const p=source[i]!,old=target[i];if(old){old.x+=(p.x-old.x)*alpha;old.y+=(p.y-old.y)*alpha}else target[i]={x:p.x,y:p.y}}}
    }
    if(this.glow>.01)this.drawEyes(time)
    // All smoke particles share a pre-baked soft texture: no per-frame radial gradients or blur.
    for(const p of game.particles)if(p.kind==='smoke'){ctx.globalAlpha=Math.sin(Math.PI*p.age/p.life)*.28;ctx.drawImage(this.smoke,p.x-p.size,p.y-p.size,p.size*2,p.size*2)}
    ctx.globalAlpha=1
    for(const stain of game.stains){ctx.globalAlpha=Math.max(0,1-stain.age/stain.life)*.65;ctx.fillStyle='#a9244c';ctx.beginPath();ctx.ellipse(stain.x,stain.y,stain.radius,4.5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ef4267';for(let i=0;i<7;i++){const x=stain.x+Math.sin(i*8.31+stain.seed)*stain.radius*1.7;ctx.fillRect(x,stain.y-1-(i%3)*2,2+(i%3)*2,2)}}
    ctx.globalAlpha=1
    for(const person of game.people)this.drawPerson(person,time)
    this.base();ctx.globalAlpha=1;ctx.globalCompositeOperation='screen'
    for(const beam of game.beams){
      const from=beam.from,to=beam.to,dx=to.x-from.x,dy=to.y-from.y,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length,angle=Math.atan2(dy,dx)
      const cosine=Math.cos(angle)*this.ratio,sine=Math.sin(angle)*this.ratio
      ctx.setTransform(cosine,sine,-sine,cosine,from.x*this.ratio,from.y*this.ratio)
      ctx.drawImage(this.beamGlow,0,-16,length,32)
      this.base();ctx.lineCap='round'
      // Preserve the seven colored moving filaments; only their expensive blur is cached.
      for(let band=0;band<7;band++){
        const offset=(band-3)*1.7;ctx.strokeStyle=RAINBOW[band]!;ctx.lineWidth=1.6
        ctx.beginPath();ctx.moveTo(from.x,from.y)
        const pieces=Math.min(45,Math.max(4,Math.ceil(length/22)))
        for(let i=1;i<=pieces;i++){const t=i/pieces,spread=Math.sin(Math.PI*t)*offset+Math.sin(i*1.8+time*17+band*.7)*.7;ctx.lineTo(from.x+dx*t+nx*spread,from.y+dy*t+ny*spread)}ctx.stroke()
      }
      ctx.strokeStyle='#fff9f2';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()
      ctx.drawImage(this.sourceGlow,from.x-21,from.y-21,42,42)
      if(beam.target!==null){ctx.drawImage(this.sourceGlow,to.x-20,to.y-20,40,40);ctx.strokeStyle='#fcf5ff';ctx.lineWidth=1.5;for(let i=0;i<7;i++){const angle=i*Math.PI*2/7+time*2,r=11+Math.sin(time*30+i)*5;ctx.beginPath();ctx.moveTo(to.x+Math.cos(angle)*r,to.y+Math.sin(angle)*r);ctx.lineTo(to.x+Math.cos(angle)*(r+8),to.y+Math.sin(angle)*(r+8));ctx.stroke()}}
    }
    for(let i=0;i<game.particles.length;i++){
      const p=game.particles[i]!;if(p.kind==='smoke')continue
      ctx.globalAlpha=Math.max(0,1-p.age/p.life)
      const angle=p.rotation+p.age*(p.kind==='spark'?5:2),cosine=Math.cos(angle)*this.ratio,sine=Math.sin(angle)*this.ratio
      ctx.setTransform(cosine,sine,-sine,cosine,p.x*this.ratio,p.y*this.ratio)
      if(p.kind==='spark'){ctx.globalCompositeOperation='screen';const color=RAINBOW.indexOf(p.color as typeof RAINBOW[number]);ctx.drawImage(this.sparks[color<0?0:color]!,-p.size*3,-p.size*2,p.size*6,p.size*4)}
      else{ctx.globalCompositeOperation='source-over';ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.2)}
    }
    this.base();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'
  }
  private drawPerson(person:Person,time:number){
    const ctx=this.ctx,shock=person.state==='shocked',fall=person.state==='falling'||person.state==='landed'
    const pose=fall||shock?8+(Math.floor(time*(shock?15:6))&3):(Math.floor(person.phase/(Math.PI*2)*8)&7)
    const alpha=person.state==='landed'?Math.max(0,1-Math.max(0,person.stateTime-.12)/.68):1
    const x=person.x+(shock?Math.sin(time*79)*3:0),y=person.y+(shock?Math.cos(time*89)*2:0),cosine=Math.cos(person.rotation)*person.scale*this.ratio,sine=Math.sin(person.rotation)*person.scale*this.ratio
    ctx.globalAlpha=alpha;ctx.setTransform(cosine,sine,-sine,cosine,x*this.ratio,y*this.ratio)
    this.sprites.drawFrame(ctx,person.variant,pose)
    if(shock){
      ctx.globalCompositeOperation='screen';ctx.strokeStyle=RAINBOW[Math.floor(time*15+person.id)%7]!;ctx.lineWidth=1.7
      for(let side=-1;side<=1;side+=2){ctx.beginPath();ctx.moveTo(side*19,-30);for(let i=0;i<7;i++)ctx.lineTo(side*(18+Math.sin(i*4.4+time*65)*9),-30+i*9);ctx.stroke()}
      if(Math.sin(time*30)>.1){ctx.strokeStyle='#fffbe9';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(0,-46,4.5,6,0,0,Math.PI*2);ctx.moveTo(0,-37);ctx.lineTo(0,2);ctx.moveTo(-12,-28);ctx.lineTo(12,-28);ctx.moveTo(-10,-21);ctx.lineTo(10,-21);ctx.moveTo(0,2);ctx.lineTo(-13,25);ctx.lineTo(-9,53);ctx.moveTo(0,2);ctx.lineTo(13,25);ctx.lineTo(9,53);ctx.stroke()}
      ctx.globalCompositeOperation='source-over'
    }
  }
  private drawEyes(time:number){
    const ctx=this.ctx
    for(const points of this.displayedEyes){
      if(points.length<4)continue
      let sumX=0,sumY=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
      for(const p of points){sumX+=p.x;sumY+=p.y;minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
      const cx=sumX/points.length,cy=sumY/points.length,width=maxX-minX,height=Math.max(5,maxY-minY)
      if(width<3)continue
      const color=RAINBOW[Math.floor(time*4)%7]!
      ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=this.glow*(.83+.17*Math.sin(time*9)**2)
      const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,width*1.5);glow.addColorStop(0,'#ffffffdd');glow.addColorStop(.18,color+'c0');glow.addColorStop(.55,color+'55');glow.addColorStop(1,color+'00')
      ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(cx,cy,width*1.5,height*2.5,0,0,Math.PI*2);ctx.fill()
      ctx.shadowColor=color;ctx.shadowBlur=24;ctx.fillStyle='#fffdf8';ctx.beginPath();points.forEach((p,i)=>{if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y)});ctx.closePath();ctx.fill();ctx.shadowBlur=9;ctx.fill()
      ctx.shadowBlur=13;ctx.strokeStyle='#e9f4ff';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(cx-width*1.35,cy);ctx.lineTo(cx+width*1.35,cy);ctx.stroke()
      ctx.restore()
    }
  }
}
