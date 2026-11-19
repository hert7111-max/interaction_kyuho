import {ArcadeGame,JET_COLORS,JET_VARIANTS} from './arcade-game'
import type {Jet} from './arcade-game'
import {pixelText,pixelWidth} from './arcade-pixel'
export type ScreenPoint={x:number;y:number}
function polygon(ctx:CanvasRenderingContext2D,points:number[][],fill:string){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x!,y!):ctx.moveTo(x!,y!));ctx.closePath();ctx.fill()}
function jetSprite(variant:number){
  const c=document.createElement('canvas');c.width=96;c.height=112;const ctx=c.getContext('2d')!;ctx.translate(48,55)
  const color=JET_COLORS[variant]!,light=['#c5e7ec','#c7cb91','#ff9c91','#b1f8e6','#ffe2a5','#e4b6f0','#e7f0dd','#91b4e8'][variant]!
  const wings=[[[0,-43],[11,-12],[39,22],[39,29],[9,16],[7,38],[-7,38],[-9,16],[-39,29],[-39,22],[-11,-12]],[[0,-45],[10,-9],[38,7],[38,20],[15,16],[12,40],[-12,40],[-15,16],[-38,20],[-38,7],[-10,-9]],[[0,-41],[8,-8],[39,-1],[39,13],[10,13],[8,32],[23,35],[23,42],[-23,42],[-23,35],[-8,32],[-10,13],[-39,13],[-39,-1],[-8,-8]],[[0,-46],[7,-22],[22,-17],[22,-9],[9,-8],[39,24],[38,31],[8,20],[7,39],[-7,39],[-8,20],[-38,31],[-39,24],[-9,-8],[-22,-9],[-22,-17],[-7,-22]],[[0,-45],[40,15],[21,36],[8,28],[0,39],[-8,28],[-21,36],[-40,15]],[[0,-44],[8,-13],[39,14],[34,27],[10,12],[7,33],[22,38],[20,43],[-20,43],[-22,38],[-7,33],[-10,12],[-34,27],[-39,14],[-8,-13]],[[0,-46],[8,-15],[16,-23],[20,-17],[17,-8],[40,17],[38,27],[13,17],[15,39],[5,41],[0,30],[-5,41],[-15,39],[-13,17],[-38,27],[-40,17],[-17,-8],[-20,-17],[-16,-23],[-8,-15]],[[0,-43],[7,-16],[30,10],[35,25],[9,16],[6,32],[18,38],[17,43],[-17,43],[-18,38],[-6,32],[-9,16],[-35,25],[-30,10],[-7,-16]]][variant]!
  polygon(ctx,wings,'#101b26');ctx.scale(.91,.95);polygon(ctx,wings,color)
  polygon(ctx,[[0,-41],[7,-9],[6,32],[0,39],[-6,32],[-7,-9]],light)
  polygon(ctx,[[0,-39],[3,-4],[3,32],[0,36]],'#ffffff40')
  polygon(ctx,[[-4,-24],[4,-24],[5,-6],[-5,-6]],'#173849');polygon(ctx,[[-3,-22],[0,-24],[1,-8],[-3,-10]],'#95d6dd')
  if(variant%3===1||variant===6){for(const x of [-9,9]){polygon(ctx,[[x-3,9],[x+3,9],[x+4,36],[x-4,36]],'#34495d');ctx.fillStyle='#f9a050';ctx.fillRect(x-2,36,4,5)}}else{ctx.fillStyle='#27313c';ctx.fillRect(-4,31,8,7);ctx.fillStyle='#eeb267';ctx.fillRect(-2,37,4,5)}
  ctx.fillStyle='#e4e7d0';ctx.fillRect(-25,12,8,2);ctx.fillRect(17,12,8,2)
  ctx.fillStyle='#dc534b';ctx.fillRect(-31,16,4,3);ctx.fillStyle='#b4e1c1';ctx.fillRect(27,16,4,3)
  return c
}
function glowSprite(){const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d')!,g=x.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,'#fff');g.addColorStop(.15,'#eeffff');g.addColorStop(.32,'#80eafaee');g.addColorStop(1,'#37a8f200');x.fillStyle=g;x.fillRect(0,0,96,96);return c}
export class ArcadeMonitor{
  readonly canvas=document.createElement('canvas')
  private ctx:CanvasRenderingContext2D
  private sprites=Array.from({length:JET_VARIANTS},(_,i)=>jetSprite(i))
  private glow=glowSprite()
  private faceImage=document.createElement('canvas')
  private explosionSeen=0
  private shards:{sx:number;sy:number;x:number;y:number;vx:number;vy:number;size:number}[]=[]
  eyes:ScreenPoint[][]=[]
  eyeGlow=0
  version=0
  constructor(){this.canvas.width=640;this.canvas.height=480;this.ctx=this.canvas.getContext('2d',{alpha:false})!}
  render(game:ArcadeGame,video:HTMLVideoElement,ready:boolean,dt:number){
    this.version++
    const ctx=this.ctx,w=640,h=480;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false
    ctx.fillStyle='#071a21';ctx.fillRect(0,0,w,h)
    if(ready&&video.readyState>=2){
      const vw=video.videoWidth,vh=video.videoHeight,scale=Math.max(w/vw,h/vh),sw=w/scale,sh=h/scale
      ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(video,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,w,h);ctx.restore()
      ctx.fillStyle='#06273822';ctx.fillRect(0,0,w,h)
    }else{
      ctx.strokeStyle='#257c7938';ctx.lineWidth=1
      for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
      for(let y=(game.time*17)%32;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
      ctx.fillStyle='#15333b';for(let i=0;i<32;i++)ctx.fillRect((i*127)%640,(i*89)%480,2,2)
    }
    if(game.explosionSerial!==this.explosionSeen){
      this.explosionSeen=game.explosionSerial;this.shards.length=0
      if(game.dead&&game.lastFace){const f=game.lastFace;this.faceImage.width=w;this.faceImage.height=h;this.faceImage.getContext('2d')!.drawImage(this.canvas,0,0)
        const step=Math.max(10,Math.ceil(Math.max(f.right-f.left,f.bottom-f.top)/9))
        for(let y=Math.max(0,f.top);y<Math.min(h,f.bottom);y+=step)for(let x=Math.max(0,f.left);x<Math.min(w,f.right);x+=step){const dx=(x-f.x)/(f.right-f.left),dy=(y-f.y)/(f.bottom-f.top);if(dx*dx+dy*dy>.29)continue;this.shards.push({sx:x,sy:y,x,y,vx:dx*460+Math.sin(x*2+y)*45,vy:dy*360-80,size:step})}
      }
    }
    if(game.dead&&game.face){ctx.save();const f=game.face;ctx.beginPath();f.outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();ctx.fillStyle='#07121b';ctx.fillRect(f.left,f.top,f.right-f.left,f.bottom-f.top);ctx.fillStyle='#223348';for(let y=f.top;y<f.bottom;y+=10)ctx.fillRect(f.left,y,f.right-f.left,2);ctx.restore()}
    if(game.dead&&game.deathAge<1.7){const t=game.deathAge;ctx.globalAlpha=Math.max(0,1-t/1.7);for(const s of this.shards){ctx.drawImage(this.faceImage,s.sx,s.sy,s.size,s.size,Math.round(s.x+s.vx*t),Math.round(s.y+s.vy*t+160*t*t),s.size,s.size)}ctx.globalAlpha=1}
    this.eyeGlow+=(Number(game.firing)-this.eyeGlow)*(1-Math.exp(-dt*24))
    if(this.eyeGlow>.01){
      const strength=this.eyeGlow*(.6+.4*Math.pow(Math.sin(game.time*38),2));ctx.save();ctx.globalCompositeOperation='lighter'
      for(const eye of game.dead?[]:this.eyes){
        if(!eye.length)continue
        let x=0,y=0,left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity
        for(const p of eye){x+=p.x;y+=p.y;left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y)}x/=eye.length;y/=eye.length
        const width=Math.max(10,right-left),height=Math.max(4,bottom-top)
        ctx.globalAlpha=strength*.8;ctx.drawImage(this.glow,x-width*1.7,y-height*4,width*3.4,height*8)
        ctx.globalAlpha=strength;ctx.fillStyle='#f0ffff';ctx.beginPath();eye.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill()
        ctx.fillStyle='#b6efff';ctx.fillRect(x-width*1.5,y-1,width*3,2)
      }ctx.restore()
    }
    for(const jet of game.jets)this.drawJet(jet,game.time)
    ctx.save();ctx.globalCompositeOperation='lighter'
    for(const b of game.bullets){ctx.strokeStyle='#f5d79c';ctx.lineWidth=3;ctx.beginPath();const speed=Math.hypot(b.vx,b.vy);ctx.moveTo(b.x-b.vx/speed*15,b.y-b.vy/speed*15);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#fffcea';ctx.fillRect(b.x-1,b.y-2,2,4)}
    for(const b of game.enemyBullets){const x=Math.round(b.x),y=Math.round(b.y),n=Math.hypot(b.vx,b.vy)||1;ctx.strokeStyle='#ff465b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-b.vx/n*11,y-b.vy/n*11);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#ffe9a2';ctx.fillRect(x-2,y-2,4,4)}
    for(const m of game.muzzles){const s=1-m.age/.075;ctx.globalAlpha=s;ctx.drawImage(this.glow,m.x-20*s,m.y-20*s,40*s,40*s);polygon(ctx,[[m.x,m.y-14*s],[m.x+4*s,m.y-3*s],[m.x+12*s,m.y],[m.x+3*s,m.y+4*s],[m.x,m.y+10*s],[m.x-3*s,m.y+3*s],[m.x-11*s,m.y],[m.x-3*s,m.y-4*s]],'#fff3ad')}
    ctx.restore()
    for(const p of game.debris){ctx.globalAlpha=(1-p.age/p.life)*(p.kind==='smoke'?.65:1);ctx.fillStyle=p.color;const size=Math.max(1,Math.round(p.size));ctx.fillRect(Math.round(p.x-size/2),Math.round(p.y-size/2),size,size)}ctx.globalAlpha=1
    if(game.hitFlash>0){ctx.globalAlpha=game.hitFlash*.2;ctx.fillStyle='#ff3c64';ctx.fillRect(0,0,w,h);ctx.globalAlpha=1}
    pixelText(ctx,`SCORE ${String(game.score).padStart(6,'0')}`,18,17,'#d4eee1')
    const combo=`${String(game.combo).padStart(2,'0')} COMBO`;pixelText(ctx,combo,w-20-pixelWidth(combo),17,game.combo?'#ffe48a':'#87a5a4')
    if(ready){
      const f=game.face,bw=144,x=Math.round(Math.max(12,Math.min(w-bw-12,(f?.x??320)-bw/2))),y=Math.round(Math.max(48,Math.min(h-54,(f?.top??108)-43))),color=game.charging?'#87ffd6':game.hp<30?'#ff5976':'#c0f5a5'
      ctx.fillStyle='#04131cdd';ctx.fillRect(x-6,y-5,bw+12,39);pixelText(ctx,`HP ${String(Math.ceil(game.hp)).padStart(3,'0')}`,x,y,color)
      if(game.charging)pixelText(ctx,'+',x+bw-12,y,'#87ffd6')
      for(let i=0;i<20;i++){ctx.fillStyle=i/20<game.hp/100?color:'#30434a';ctx.fillRect(x+i*7,y+21,5,7)}
      if(game.dead){const label=game.charging?'RECHARGE':'KO',center=game.face??game.lastFace;pixelText(ctx,label,Math.max(12,Math.min(w-pixelWidth(label,3)-12,(center?.x??320)-pixelWidth(label,3)/2)),Math.max(95,Math.min(350,center?.y??240)),color,3)}
    }
  }
  private drawJet(jet:Jet,time:number){const ctx=this.ctx;ctx.save();ctx.translate(Math.round(jet.x),Math.round(jet.y));ctx.rotate(jet.angle);ctx.scale(jet.scale,jet.scale);if(jet.state==='falling')ctx.globalAlpha=Math.max(0,1-jet.age*.25);ctx.drawImage(this.sprites[jet.variant]!,-48,-55);if(jet.state==='flying'){ctx.fillStyle=Math.floor(time*18+jet.id)%2?'#ffd88a':'#ef8d55';ctx.fillRect(-2,39,4,6+Math.sin(time*29)*3)}ctx.restore()}
}
