import { PapaGame, RAINBOW } from './papa-game'
import type { Vec,Person } from './papa-game'
import { HumanSprites } from './papa-sprites'
export class PapaRenderer{
  private canvas:HTMLCanvasElement
  private ctx:CanvasRenderingContext2D
  private sprites=new HumanSprites()
  private ratio=1
  eyes:Vec[][]=[]
  private displayedEyes:Vec[][]=[]
  glow=0
  constructor(canvas:HTMLCanvasElement){this.canvas=canvas;this.ctx=canvas.getContext('2d')!;this.resize()}
  resize(){const dpr=Math.min(devicePixelRatio,1.75);this.canvas.width=Math.round(innerWidth*dpr);this.canvas.height=Math.round(innerHeight*dpr);this.ratio=innerHeight/900*dpr;this.ctx.setTransform(this.ratio,0,0,this.ratio,0,0);this.ctx.imageSmoothingEnabled=false}
  render(game:PapaGame,dt:number){
    const ctx=this.ctx,w=game.width,time=game.time
    ctx.clearRect(0,0,w,900)
    const power=game.beams.length?1:0
    this.glow+=(power-this.glow)*(1-Math.exp(-dt*(power?26:16)))
    if(!this.eyes.length)this.displayedEyes=[]
    else this.displayedEyes=this.eyes.map((eye,index)=>eye.map((p,i)=>{const old=this.displayedEyes[index]?.[i];const alpha=1-Math.exp(-dt*35);return old?{x:old.x+(p.x-old.x)*alpha,y:old.y+(p.y-old.y)*alpha}:p}))
    if(this.glow>.01)this.drawEyes(time)
    for(const p of game.particles)if(p.kind==='smoke'){
      ctx.save();ctx.globalAlpha=Math.sin(Math.PI*p.age/p.life)*.28;const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size);g.addColorStop(0,'#c8d5dd');g.addColorStop(.45,'#7e919c99');g.addColorStop(1,'#51667400');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();ctx.restore()
    }
    for(const stain of game.stains){ctx.save();ctx.globalAlpha=Math.max(0,1-stain.age/stain.life)*.65;ctx.fillStyle='#a9244c';ctx.beginPath();ctx.ellipse(stain.x,stain.y,stain.radius,4.5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ef4267';for(let i=0;i<7;i++){const x=stain.x+Math.sin(i*8.31+stain.seed)*stain.radius*1.7;ctx.fillRect(x,stain.y-1-(i%3)*2,2+(i%3)*2,2)}ctx.restore()}
    for(const person of game.people)this.drawPerson(person,time)
    for(const beam of game.beams){
      const from=beam.from,to=beam.to,dx=to.x-from.x,dy=to.y-from.y,length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length
      ctx.save();ctx.globalCompositeOperation='screen';ctx.lineCap='round'
      // Seven bright strands keep the whole ROYGBIV spectrum visible in every beam.
      for(let band=0;band<7;band++){
        const color=RAINBOW[band]!,offset=(band-3)*1.7
        ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=9;ctx.lineWidth=2.1
        ctx.beginPath();ctx.moveTo(from.x+nx*offset*.12,from.y+ny*offset*.12)
        const pieces=Math.min(45,Math.max(4,Math.ceil(length/22)))
        for(let i=1;i<=pieces;i++){const t=i/pieces,ripple=Math.sin(i*1.8+time*17+band*.7)*.7,spread=Math.sin(Math.PI*t)*offset+ripple;ctx.lineTo(from.x+dx*t+nx*spread,from.y+dy*t+ny*spread)}ctx.stroke()
      }
      ctx.shadowBlur=7;ctx.shadowColor='#fff';ctx.strokeStyle='#fff9f2';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()
      const g=ctx.createRadialGradient(from.x,from.y,0,from.x,from.y,21);g.addColorStop(0,'#fff');g.addColorStop(.2,'#e3edff');g.addColorStop(.42,'#dda6ff9c');g.addColorStop(1,'#a89aff00');ctx.fillStyle=g;ctx.fillRect(from.x-21,from.y-21,42,42)
      if(beam.target!==null){ctx.shadowBlur=18;ctx.shadowColor=RAINBOW[Math.floor(time*12)%7]!;ctx.strokeStyle='#fcf5ff';ctx.lineWidth=1.5;for(let i=0;i<7;i++){const angle=i*Math.PI*2/7+time*2,r=11+Math.sin(time*30+i)*5;ctx.beginPath();ctx.moveTo(to.x+Math.cos(angle)*r,to.y+Math.sin(angle)*r);ctx.lineTo(to.x+Math.cos(angle)*(r+8),to.y+Math.sin(angle)*(r+8));ctx.stroke()}}
      ctx.restore()
    }
    for(const p of game.particles)if(p.kind!=='smoke'){
      ctx.save();ctx.globalAlpha=Math.max(0,1-p.age/p.life)
      ctx.translate(p.x,p.y);ctx.rotate(p.rotation+p.age*(p.kind==='spark'?5:2));ctx.fillStyle=p.color
      if(p.kind==='spark'){ctx.globalCompositeOperation='screen';ctx.shadowColor=p.color;ctx.shadowBlur=7;ctx.fillRect(-p.size,-1,p.size*3,2)}else ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.2)
      ctx.restore()
    }
  }
  private drawPerson(person:Person,time:number){
    const ctx=this.ctx,shock=person.state==='shocked',fall=person.state==='falling'||person.state==='landed'
    let pose=fall?8+Math.floor(person.stateTime*6)%3:Math.floor(person.phase/(Math.PI*2)*8)%8
    if(shock)pose=8+Math.floor(time*16)%3
    const alpha=person.state==='landed'?Math.max(0,1-Math.max(0,person.stateTime-.12)/.68):1
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(person.x+(shock?Math.sin(time*79)*3:0),person.y+(shock?Math.cos(time*89)*2:0));ctx.rotate(person.rotation);ctx.scale(person.scale,person.scale)
    ctx.shadowColor='#09111c4d';ctx.shadowBlur=2;ctx.shadowOffsetY=3
    const sprite=this.sprites.get(person.variant,pose)
    ctx.drawImage(sprite,-26,-45,52,90);ctx.shadowBlur=0;ctx.shadowOffsetY=0
    if(shock){
      ctx.save();ctx.globalCompositeOperation='screen';ctx.shadowBlur=11;ctx.shadowColor='#adcdff';ctx.strokeStyle=RAINBOW[Math.floor(time*15+person.id)%7]!;ctx.lineWidth=1.7
      for(let side=-1;side<=1;side+=2){ctx.beginPath();ctx.moveTo(side*19,-35);for(let i=0;i<7;i++)ctx.lineTo(side*(18+Math.sin(i*4.4+time*65)*9),-35+i*11);ctx.stroke()}
      // A brief cartoon X-ray makes the electrocution readable without obscuring the costume.
      if(Math.sin(time*30)>.1){ctx.strokeStyle='#fffbe9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(0,9);ctx.moveTo(-9,-8);ctx.lineTo(9,-8);ctx.moveTo(-7,-2);ctx.lineTo(7,-2);ctx.moveTo(0,9);ctx.lineTo(-9,29);ctx.moveTo(0,9);ctx.lineTo(9,29);ctx.stroke();ctx.fillStyle='#fffbe9';ctx.fillRect(-4,-27,8,8)}
      ctx.restore()
    }
    ctx.restore()
  }
  private drawEyes(time:number){
    const ctx=this.ctx
    for(const points of this.displayedEyes){
      if(points.length<4)continue
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y),cx=xs.reduce((a,b)=>a+b,0)/xs.length,cy=ys.reduce((a,b)=>a+b,0)/ys.length,width=Math.max(...xs)-Math.min(...xs),height=Math.max(5,Math.max(...ys)-Math.min(...ys))
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
