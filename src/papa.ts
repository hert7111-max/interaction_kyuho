import './papa.css'
import { PapaGame, RAINBOW, isPointing } from './papa-game'
import type { Aim,Vec } from './papa-game'
import { PapaRenderer } from './papa-renderer'
import { PapaTracking } from './papa-tracking'
import type { Tracking } from './papa-tracking'
import { cameraToSurface,smoothPoint } from './water-math'
const symbols:Record<string,string>={camera:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',off:'<path d="m3 3 18 18M9 6l1-3h4l2 3h2a3 3 0 0 1 3 3v8M6 6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12M9 10a4 4 0 0 0 5 5"/>',play:'<path d="m8 4 12 8-12 8V4Z"/>',reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'}
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name]}</svg>`
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`<main class="papa-app"><video id="papa-video" autoplay playsinline muted aria-hidden="true"></video><div class="papa-shade" aria-hidden="true"></div><canvas id="papa-canvas" aria-label="손끝 레이저로 기어오르는 8등신 레트로 인간 캐릭터를 떨어뜨리는 카메라 게임"></canvas><button id="papa-start" class="papa-start" aria-label="카메라 시작">${icon('camera')}</button><div class="papa-palette" id="papa-palette" aria-hidden="true">${RAINBOW.map(color=>`<i style="color:${color}"></i>`).join('')}</div><div class="papa-controls" role="group" aria-label="게임 조작"><button id="papa-camera" aria-label="카메라 시작" aria-pressed="false">${icon('camera')}</button><button id="papa-demo" aria-label="마우스로 체험" aria-pressed="false">${icon('play')}</button><button id="papa-reset" aria-label="다시 시작">${icon('reset')}</button><button id="papa-fullscreen" aria-label="전체 화면">${icon('expand')}</button></div><div class="papa-error" id="papa-error" role="alert"></div></main>`
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!
const video=$<HTMLVideoElement>('#papa-video'),canvas=$<HTMLCanvasElement>('#papa-canvas'),start=$<HTMLButtonElement>('#papa-start'),camera=$<HTMLButtonElement>('#papa-camera'),demoButton=$<HTMLButtonElement>('#papa-demo')
let game=new PapaGame(innerWidth/innerHeight*900)
const renderer=new PapaRenderer(canvas)
let stream:MediaStream|null=null,tracker:PapaTracking|null=null,active=false,loading=false,ready=false,busy=false,disposed=false,demo=false
let generation=0,lastCapture=0,lastVideoTime=-1,lastHandAt=0,lastFaceAt=0,lastTrackingTime=0,lastTime=0,animation=0,watchdog=0,lastPresent=0
let aims:Aim[]=[],pointer:Vec|null=null
const previous=new Map<string,{tip:Vec;direction:Vec}>()
function resetTracking(){aims=[];previous.clear();renderer.eyes=[];renderer.glow=0;game.beams=[];lastHandAt=lastFaceAt=lastTrackingTime=0}
function cameraButton(){camera.innerHTML=icon(active?'off':'camera');camera.setAttribute('aria-label',active?'카메라 끄기':'카메라 시작');camera.setAttribute('aria-pressed',String(active))}
function stopCamera(){generation++;active=ready=busy=false;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;video.classList.remove('on');tracker?.close();tracker=null;clearTimeout(watchdog);resetTracking();cameraButton()}
function failure(message:string){stopCamera();start.hidden=false;$('#papa-error').textContent=message}
async function loadTracker(){
  const next=new PapaTracking();tracker=next
  await next.init(new URL(import.meta.env.BASE_URL,location.href).href)
  if(disposed||tracker!==next){next.close();throw new Error('Cancelled')}
  next.onresult=data=>{busy=false;clearTimeout(watchdog);if(data.generation===generation&&active)receiveTracking(data)}
  next.onerror=()=>failure('인식이 중단됐어요. 카메라 버튼으로 다시 시작해주세요.')
  ready=true
}
async function startCamera(){
  if(loading)return
  loading=true;start.disabled=camera.disabled=demoButton.disabled=true;start.classList.add('loading');start.hidden=false;$('#papa-error').textContent=''
  try{
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('카메라는 HTTPS 또는 localhost에서 사용할 수 있어요.')
    stopCamera();demo=false;demoButton.setAttribute('aria-pressed','false')
    const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}})
    if(disposed){next.getTracks().forEach(track=>track.stop());return}
    stream=next;video.srcObject=stream;await video.play();video.classList.add('on');await loadTracker()
    if(disposed)return
    active=true;lastVideoTime=-1;start.hidden=true;cameraButton();if(document.hidden){stream?.getVideoTracks().forEach(track=>track.enabled=false);video.pause()}
    stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(active)failure('카메라 연결이 끊겼어요.')})
  }catch(error){
    const name=error instanceof Error?error.name:''
    failure(name==='NotAllowedError'?'카메라 권한을 허용한 뒤 다시 눌러주세요.':name==='NotFoundError'?'카메라를 찾지 못했어요.':name==='NotReadableError'?'다른 앱에서 카메라를 사용 중인지 확인해주세요.':error instanceof Error?error.message:'카메라를 시작하지 못했어요.')
  }finally{loading=false;start.disabled=camera.disabled=demoButton.disabled=false;start.classList.remove('loading')}
}
function toWorld(point:Vec):Vec{const uv=cameraToSurface(point,video.videoWidth/video.videoHeight,innerWidth/innerHeight,true);return{x:uv.x*game.width,y:(1-uv.y)*900}}
function receiveTracking(data:Tracking){
  const dt=lastTrackingTime?Math.min(.12,(data.timestamp-lastTrackingTime)/1000):.05;lastTrackingTime=data.timestamp;lastHandAt=performance.now()
  const seen=new Set<string>()
  aims=data.landmarks.map((hand,index)=>{
    let id=data.handedness[index]?.[0]?.categoryName??String(index);if(seen.has(id))id+=index;seen.add(id)
    const raw=toWorld(hand[8]!),joint=toWorld(hand[6]!),old=previous.get(id)
    const smooth=old?smoothPoint({x:old.tip.x/game.width,y:old.tip.y/900},{x:raw.x/game.width,y:raw.y/900},dt):{x:raw.x/game.width,y:raw.y/900}
    const tip={x:smooth.x*game.width,y:smooth.y*900}
    const dx=raw.x-joint.x,dy=raw.y-joint.y,length=Math.hypot(dx,dy)
    let direction=length>7?{x:dx/length,y:dy/length}:old?.direction??{x:0,y:-1}
    if(old&&length>7){const alpha=1-Math.exp(-dt*22),x=old.direction.x+(direction.x-old.direction.x)*alpha,y=old.direction.y+(direction.y-old.direction.y)*alpha,n=Math.hypot(x,y);direction=n>.001?{x:x/n,y:y/n}:direction}
    previous.set(id,{tip,direction})
    return{id,tip,direction,pointing:isPointing(hand,video.videoWidth/video.videoHeight),foreshortened:length<20}
  }).filter(aim=>aim.tip.x>=0&&aim.tip.x<=game.width&&aim.tip.y>=0&&aim.tip.y<=900)
  for(const id of previous.keys())if(!seen.has(id))previous.delete(id)
  if(data.eyes!==null){lastFaceAt=performance.now();renderer.eyes=data.eyes.map(eye=>eye.map(toWorld))}
}
async function capture(now:number){
  if(!active||!ready||busy||!tracker||document.hidden||video.readyState<2||now-lastCapture<tracker.budget.interval||lastVideoTime===video.currentTime)return
  busy=true;lastCapture=now;lastVideoTime=video.currentTime;const token=generation,current=tracker
  clearTimeout(watchdog);watchdog=window.setTimeout(()=>{if(active)failure('인식이 멈췄어요. 카메라를 다시 켜주세요.')},12000)
  try{await current.frame(video,now,token,aims.some(aim=>aim.pointing))}
  catch{if(token===generation){busy=false;if(active)failure('카메라 영상을 읽지 못했어요. 외부 브라우저에서 다시 시도해주세요.')}}
}
function frame(now:number){
  if(disposed||document.hidden)return
  if(lastPresent&&now-lastPresent<1000/60-.75){animation=requestAnimationFrame(frame);return}
  lastPresent=now-((now-lastPresent)%(1000/60))
  const dt=lastTime?Math.min(.06,(now-lastTime)/1000):1/60;lastTime=now
  if(!document.hidden){
    void capture(now)
    if(active&&now-lastHandAt>350){aims=[];previous.clear()}
    if(active&&now-lastFaceAt>420)renderer.eyes=[]
    let current=aims
    if(demo&&pointer){const tip={x:game.width*.5,y:900*.83},dx=pointer.x-tip.x,dy=pointer.y-tip.y,length=Math.hypot(dx,dy)||1;current=[{id:'pointer',tip,direction:{x:dx/length,y:dy/length},pointing:true}]}
    game.update(dt,current);renderer.render(game,dt);$('#papa-palette').classList.toggle('firing',game.beams.length>0)
  }
  animation=requestAnimationFrame(frame)
}
animation=requestAnimationFrame(frame)
start.addEventListener('click',()=>void startCamera())
camera.addEventListener('click',()=>{if(active){stopCamera();start.hidden=false}else void startCamera()})
demoButton.addEventListener('click',()=>{if(loading)return;stopCamera();demo=!demo;pointer=null;start.hidden=demo;demoButton.setAttribute('aria-pressed',String(demo));$('#papa-error').textContent=''})
$('#papa-reset').addEventListener('click',()=>{game.reset();resetTracking();pointer=null})
$('#papa-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen?.()}catch{/* Unsupported fullscreen leaves the interaction running. */}})
function point(event:PointerEvent){return{x:event.clientX/innerWidth*game.width,y:event.clientY/innerHeight*900}}
canvas.addEventListener('pointerdown',event=>{if(!demo)return;canvas.setPointerCapture(event.pointerId);pointer=point(event)})
canvas.addEventListener('pointermove',event=>{if(demo&&canvas.hasPointerCapture(event.pointerId))pointer=point(event)})
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{pointer=null})
addEventListener('blur',()=>{pointer=null;aims=[]})
addEventListener('resize',()=>{const width=innerWidth/innerHeight*900,factor=width/game.width;for(const item of game.people)item.x*=factor;for(const item of game.particles)item.x*=factor;for(const item of game.stains)item.x*=factor;game.width=width;renderer.resize();resetTracking();pointer=null})
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){generation++;resetTracking();pointer=null;clearTimeout(watchdog);cancelAnimationFrame(animation);stream?.getVideoTracks().forEach(track=>track.enabled=false);video.pause()}
  else{lastVideoTime=-1;lastTime=lastPresent=0;if(active){stream?.getVideoTracks().forEach(track=>track.enabled=true);void video.play().catch(()=>failure('카메라를 다시 시작해주세요.'))}cancelAnimationFrame(animation);animation=requestAnimationFrame(frame)}
})
function dispose(){disposed=true;cancelAnimationFrame(animation);stopCamera()}
addEventListener('pagehide',dispose,{once:true});addEventListener('pageshow',event=>{if(event.persisted)location.reload()})
if(import.meta.hot)import.meta.hot.dispose(dispose)
