import {ArcadeGame} from '../src/arcade-game'
import {ArcadeMonitor} from '../src/arcade-monitor'
import {ArcadeScene} from '../src/arcade-scene'
const canvas=document.createElement('canvas');document.body.append(canvas);canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%'
const pre=document.createElement('pre');pre.style.cssText='position:fixed;top:10px;left:10px;z-index:10;color:#def4ec;background:#06151bbb;padding:12px;font:12px monospace;white-space:pre-wrap';document.body.append(pre)
const log=(s:string)=>pre.textContent+='\n'+s
addEventListener('error',e=>log('FAIL '+e.message))
const monitor=new ArcadeMonitor(),game=new ArcadeGame(()=>.42),scene=new ArcadeScene(canvas,monitor),video=document.createElement('video');video.muted=true;video.playsInline=true
const image=new Image();image.src='__QA_IMAGE__'
image.onload=async()=>{
 const source=document.createElement('canvas');source.width=image.width;source.height=image.height;const ctx=source.getContext('2d')!;ctx.drawImage(image,0,0)
 video.srcObject=source.captureStream(30);await video.play()
 // These are controlled fixture contours and inputs, not a real camera / model test.
 monitor.eyes=[[{x:384,y:281},{x:393,y:275},{x:404,y:278},{x:400,y:285},{x:390,y:287}],[{x:313,y:241},{x:324,y:236},{x:334,y:240},{x:330,y:246},{x:319,y:247}]]
 let last=0,count=0,times:number[]=[],done=false
 function frame(now:number){
  ctx.drawImage(image,0,0);const dt=last?Math.min(.05,(now-last)/1000):1/60;last=now
  const hands=[{id:'Left',tip:{x:230,y:400},direction:{x:.17,y:-1},firing:true,curls:[0,.7+.2*Math.sin(now*.008),.9,.85],thumb:{x:Math.sin(now*.003)*.7,y:Math.cos(now*.005)*.6},activity:.8},{id:'Right',tip:{x:460,y:390},direction:{x:-.1,y:-1},firing:true,curls:[0,.9,.8,.9],thumb:{x:Math.sin(now*.004)*.6,y:Math.cos(now*.003)*.7},activity:.6}]
  const begin=performance.now();game.update(dt,hands);monitor.render(game,video,true,dt);scene.render(game,dt);times.push(performance.now()-begin);count++
  if(count===1){log('3D scene + CRT shader initialized');log('Fixture video / two firing hands / eye contours')}
  if(count===100&&!done){
   const gl=scene.renderer.getContext(),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data)
   let lit=0;for(let i=0;i<data.length;i+=4)if(Math.max(data[i],data[i+1],data[i+2])>60)lit++
   log((lit>10000?'PASS':'FAIL')+' scene pixels: '+lit);log((game.rounds>20?'PASS':'FAIL')+' dual-hand sustained fire: '+game.rounds+' rounds');log('Jets '+game.jets.length+' / kills '+game.kills);log('Draw calls '+scene.renderer.info.render.calls+' / triangles '+scene.renderer.info.render.triangles)
   times.sort((a,b)=>a-b);log('CPU update + render p95 '+times[Math.floor(times.length*.95)].toFixed(2)+' ms');done=true
   if(new URLSearchParams(location.search).has('hold'))return
  }
  requestAnimationFrame(frame)
 }
 requestAnimationFrame(frame)
}
addEventListener('resize',()=>scene.resize())
