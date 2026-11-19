import type {FaceTarget} from './arcade-game'
function smokeSprite(){
 const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d')!,g=ctx.createRadialGradient(48,48,3,48,48,45)
 g.addColorStop(0,'#54504bed');g.addColorStop(.35,'#454447bb');g.addColorStop(.7,'#34383f72');g.addColorStop(1,'#292d3500');ctx.fillStyle=g;ctx.fillRect(0,0,96,96);return c
}
function flameSprite(frame:number){
 const c=document.createElement('canvas');c.width=48;c.height=80;const ctx=c.getContext('2d')!
 const shape=(color:string,points:number[][])=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x!,y!):ctx.moveTo(x!,y!));ctx.closePath();ctx.fill()}
 const sway=Math.sin(frame*1.9)*6
 shape('#db3e16',[[8,78],[3,58],[9,42],[8,29],[18,40],[24+sway,5],[31,31],[39,20],[35,49],[45,60],[38,78]])
 shape('#ff8727',[[14,78],[9,59],[18,48],[22,24],[28,44],[31,39],[36,61],[33,78]])
 shape('#ffe49a',[[19,78],[16,63],[23,48],[25,59],[30,67],[28,78]])
 return c
}
/** Fixed sprite/fragment counts, no per-frame canvases, blur passes or readback. */
export class BurntFace{
 private smoke=smokeSprite()
 private flames=Array.from({length:6},(_,i)=>flameSprite(i))
 draw(ctx:CanvasRenderingContext2D,face:FaceTarget,origin:FaceTarget,image:HTMLCanvasElement,time:number,hp:number){
  const {left,top,right,bottom,x,y}=face,w=right-left,h=bottom-top,heat=.5+.5*(1-hp/100)
  ctx.save();ctx.beginPath();face.outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip()
  ctx.drawImage(image,origin.left,origin.top,origin.right-origin.left,origin.bottom-origin.top,left,top,w,h)
  // Preserve recognisable face fragments beneath soot, instead of cutting an empty hole.
  for(let i=0;i<18;i++){
   const col=i%4,row=Math.floor(i/4),u=col/4,v=row/5,size=.27,dx=Math.sin(i*7.13)*w*.035,dy=Math.cos(i*4.7)*h*.023
   ctx.drawImage(image,origin.left+u*(origin.right-origin.left),origin.top+v*(origin.bottom-origin.top),(origin.right-origin.left)*size,(origin.bottom-origin.top)*.22,left+u*w+dx,top+v*h+dy,w*size,h*.22)
  }
  ctx.fillStyle='#211711b8';ctx.fillRect(left,top,w,h)
  for(let i=0;i<11;i++){
   const px=left+w*(.08+((i*37)%83)/100),py=top+h*(.12+((i*23)%71)/100),sx=w*(.06+(i%3)*.035),sy=h*(.045+(i%4)*.025)
   ctx.fillStyle=i%2?'#211d1b':'#34302a';ctx.beginPath();ctx.moveTo(px-sx,py);ctx.lineTo(px,py-sy);ctx.lineTo(px+sx,py-sy*.3);ctx.lineTo(px+sx*.6,py+sy);ctx.closePath();ctx.fill()
  }
  for(let i=0;i<8;i++){
   const angle=i*2.399,px=x+Math.cos(angle)*w*.28,py=y+Math.sin(angle)*h*.3
   ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(angle+.7)*w*.14,py+Math.sin(angle+.7)*h*.14);ctx.lineTo(px+Math.cos(angle)*w*.25,py+Math.sin(angle)*h*.25)
   ctx.strokeStyle='#100e10';ctx.lineWidth=5;ctx.stroke();ctx.globalAlpha=(.5+.35*Math.sin(time*5+i))*heat;ctx.strokeStyle='#ed7c31';ctx.lineWidth=1.4;ctx.stroke();ctx.globalAlpha=1
  }
  ctx.restore()
  // Smouldering smoke rolls above the face, including outside its silhouette.
  for(let i=0;i<13;i++){
   const phase=(time*(.25+(i%3)*.035)+i*.277)%1,px=x+Math.sin(i*2.1)*w*.31+Math.sin(time*1.4+i)*w*.07,py=bottom-h*.24-phase*h*1.12,size=w*(.22+phase*.45)
   ctx.globalAlpha=Math.sin(phase*Math.PI)*(.48+(i%3)*.06)*heat;ctx.drawImage(this.smoke,px-size/2,py-size/2,size,size)
  }
  ctx.globalAlpha=.9*heat
  for(let i=0;i<9;i++){
   const px=left+w*(.12+i*.095),py=bottom-h*(.03+((i*7)%5)*.11),size=w*(.18+(i%3)*.04),height=size*(1.4+.2*Math.sin(time*12+i))
   ctx.drawImage(this.flames[(Math.floor(time*14)+i)%6]!,Math.round(px-size/2),Math.round(py-height),Math.round(size),Math.round(height))
  }
  ctx.globalAlpha=heat
  for(let i=0;i<18;i++){const phase=(time*.6+i*.137)%1;ctx.fillStyle=i%3?'#ff963f':'#ffdb86';ctx.fillRect(Math.round(x+Math.sin(i*5.1+phase)*w*.4),Math.round(bottom-phase*h*1.4),i%2+1,2+(i%3))}
  ctx.globalAlpha=1
 }
}
