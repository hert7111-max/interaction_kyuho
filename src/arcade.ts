import './arcade.css'
import {ArcadeGame,fingerCurl,isFingerGun,faceTarget} from './arcade-game'
import type {ArcadeHand,FaceTarget} from './arcade-game'
import {ArcadeMonitor} from './arcade-monitor'
import {ArcadeScene} from './arcade-scene'
import {PapaTracking} from './papa-tracking'
import type {Tracking} from './papa-tracking'
import {cameraToSurface,smoothPoint} from './water-math'
import type {Point} from './water-math'
const paths:Record<string,string>={camera:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',off:'<path d="m3 3 18 18M9 6l1-3h4l2 3h2a3 3 0 0 1 3 3v8M6 6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12M9 10a4 4 0 0 0 5 5"/>',reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'}
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`
document.querySelector('#app')!.innerHTML=`<main class="arcade-app"><video id="arcade-video" autoplay playsinline muted aria-hidden="true"></video><canvas id="arcade-canvas" aria-label="로우폴리 방에서 컨트롤러를 잡고 CRT 속 손가락 총으로 전투기를 격추하는 카메라 게임"></canvas><div class="arcade-vignette" aria-hidden="true"></div><button id="arcade-start" class="arcade-start" aria-label="카메라로 게임 시작">${icon('camera')}</button><div class="arcade-controls" role="group" aria-label="게임 조작"><button id="arcade-camera" aria-label="카메라 시작" aria-pressed="false">${icon('camera')}</button><button id="arcade-reset" aria-label="게임 다시 시작">${icon('reset')}</button><button id="arcade-fullscreen" aria-label="전체 화면">${icon('expand')}</button></div><div id="arcade-error" class="arcade-error" role="alert"></div></main>`
const $=<T extends HTMLElement>(q:string)=>document.querySelector<T>(q)!
const video=$<HTMLVideoElement>('#arcade-video'),canvas=$<HTMLCanvasElement>('#arcade-canvas'),start=$<HTMLButtonElement>('#arcade-start'),camera=$<HTMLButtonElement>('#arcade-camera')
const game=new ArcadeGame(),monitor=new ArcadeMonitor()
let scene:ArcadeScene|null=null
try{scene=new ArcadeScene(canvas,monitor)}catch{$('#arcade-error').textContent='3D 화면을 준비하지 못했어요. 최신 Chrome 또는 Safari에서 다시 열어주세요.';start.disabled=camera.disabled=true}
let stream:MediaStream|null=null,tracker:PapaTracking|null=null,active=false,loading=false,busy=false,disposed=false,generation=0,lastCapture=0,lastVideoTime=-1,lastHandAt=0,lastFaceAt=0,lastTrackingTime=0,lastTime=0,lastPresent=0,lastMonitor=0,animation=0,watchdog=0
let hands:ArcadeHand[]=[]
let face:FaceTarget|null=null
const previous=new Map<string,{tip:Point;direction:Point;curls:number[];neutral:Point}>()
function resetTracking(){hands=[];face=null;previous.clear();monitor.eyes=[];monitor.eyeGlow=0;lastHandAt=lastFaceAt=lastTrackingTime=0}
function updateButton(){camera.innerHTML=icon(active?'off':'camera');camera.setAttribute('aria-label',active?'카메라 끄기':'카메라 시작');camera.setAttribute('aria-pressed',String(active))}
function stopCamera(){generation++;active=busy=false;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;tracker?.close();tracker=null;clearTimeout(watchdog);resetTracking();updateButton()}
function fail(text:string){stopCamera();start.hidden=false;$('#arcade-error').textContent=text}
async function startCamera(){
  if(loading||!scene)return
  loading=true;start.disabled=camera.disabled=true;start.hidden=false;start.classList.add('loading');$('#arcade-error').textContent=''
  try{
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('카메라는 HTTPS 또는 localhost에서 사용할 수 있어요.')
    stopCamera()
    const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}})
    if(disposed){next.getTracks().forEach(t=>t.stop());return}
    stream=next;video.srcObject=stream;await video.play()
    const tracking=new PapaTracking();tracker=tracking;await tracking.init(new URL(import.meta.env.BASE_URL,location.href).href)
    if(disposed||tracker!==tracking){tracking.close();return}
    tracking.onresult=data=>{busy=false;clearTimeout(watchdog);if(data.generation===generation&&active)receive(data)}
    tracking.onerror=()=>fail('손과 눈 인식이 중단됐어요. 카메라를 다시 켜주세요.')
    active=true;lastVideoTime=-1;start.hidden=true;updateButton()
    if(document.hidden){stream.getVideoTracks().forEach(t=>t.enabled=false);video.pause()}
    stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(active)fail('카메라 연결이 끊겼어요.')})
  }catch(error){const name=error instanceof Error?error.name:'';fail(name==='NotAllowedError'?'브라우저와 OS의 카메라 권한을 허용한 뒤 다시 눌러주세요.':name==='NotFoundError'?'연결된 카메라를 찾지 못했어요.':name==='NotReadableError'?'다른 앱에서 카메라를 사용 중인지 확인해주세요.':error instanceof Error?error.message:'카메라를 시작하지 못했어요.')}
  finally{loading=false;start.disabled=camera.disabled=false;start.classList.remove('loading')}
}
function screenPoint(point:Point){const uv=cameraToSurface(point,video.videoWidth/video.videoHeight,4/3,true);return{x:uv.x*640,y:(1-uv.y)*480}}
function receive(data:Tracking){
  const now=performance.now(),dt=lastTrackingTime?Math.min(.15,(data.timestamp-lastTrackingTime)/1000):.05;lastTrackingTime=data.timestamp;lastHandAt=now
  const seen=new Set<string>(),nextHands:ArcadeHand[]=[]
  for(const [index,hand] of data.landmarks.entries()){
    if(hand.length<21)continue
    let id=data.handedness[index]?.[0]?.categoryName??String(index);if(seen.has(id))id+=index;seen.add(id)
    const raw=screenPoint(hand[8]!),joint=screenPoint(hand[6]!),old=previous.get(id)
    const point=old?smoothPoint({x:old.tip.x/640,y:old.tip.y/480},{x:raw.x/640,y:raw.y/480},dt):{x:raw.x/640,y:raw.y/480},tip={x:point.x*640,y:point.y*480}
    const dx=raw.x-joint.x,dy=raw.y-joint.y,length=Math.hypot(dx,dy)
    let direction=length>12?{x:dx/length,y:dy/length}:{x:0,y:-1}
    if(old&&length>12){const alpha=1-Math.exp(-dt*23),x=old.direction.x+(direction.x-old.direction.x)*alpha,y=old.direction.y+(direction.y-old.direction.y)*alpha,n=Math.hypot(x,y)||1;direction={x:x/n,y:y/n}}
    const aspect=video.videoWidth/video.videoHeight,curls=[5,9,13,17].map(base=>fingerCurl(hand,base,aspect))
    const palm=Math.max(.035,Math.hypot((hand[5]!.x-hand[17]!.x)*aspect,hand[5]!.y-hand[17]!.y)),thumbRaw={x:(hand[4]!.x-hand[2]!.x)*aspect/palm,y:(hand[4]!.y-hand[2]!.y)/palm},neutral=old?.neutral??thumbRaw
    const clamp=(n:number)=>Math.max(-1,Math.min(1,n)),thumb={x:clamp((thumbRaw.x-neutral.x)*2.4),y:clamp((thumbRaw.y-neutral.y)*2.4)}
    const activity=old?Math.min(1,curls.reduce((sum,c,i)=>sum+Math.abs(c-old.curls[i]!),0)*1.6+Math.hypot(raw.x-old.tip.x,raw.y-old.tip.y)/80):0
    previous.set(id,{tip,direction,curls,neutral})
    if(tip.x>=0&&tip.x<=640&&tip.y>=0&&tip.y<=480)nextHands.push({id,tip,direction,curls,thumb,activity,firing:isFingerGun(hand,aspect)})
  }
  hands=nextHands;for(const id of previous.keys())if(!seen.has(id))previous.delete(id)
  if(data.eyes!==null){lastFaceAt=now;monitor.eyes=data.eyes.map(eye=>eye.map(screenPoint))}
  if(data.faceOutline!==undefined&&data.faceOutline!==null)face=faceTarget(data.faceOutline.map(screenPoint))
}
async function capture(now:number){
  if(!active||!tracker||busy||document.hidden||video.readyState<2||lastVideoTime===video.currentTime||now-lastCapture<tracker.budget.interval)return
  busy=true;lastCapture=now;lastVideoTime=video.currentTime;const current=tracker,token=generation
  clearTimeout(watchdog);watchdog=window.setTimeout(()=>{if(active)fail('인식이 멈췄어요. 카메라를 다시 켜주세요.')},12000)
  try{await current.frame(video,now,token,true)}catch{if(token===generation){busy=false;if(active)fail('카메라 영상을 읽지 못했어요. 외부 브라우저에서 다시 시도해주세요.')}}
}
function frame(now:number){
  if(disposed||document.hidden)return
  if(lastPresent&&now-lastPresent<1000/60-.75){animation=requestAnimationFrame(frame);return}
  lastPresent=now-((now-lastPresent)%(1000/60));const dt=lastTime?Math.min(.06,(now-lastTime)/1000):1/60;lastTime=now
  void capture(now)
  if(active&&now-lastHandAt>350){hands=[];previous.clear()}if(active&&now-lastFaceAt>500)monitor.eyes=[]
  const fresh=active&&lastFaceAt>0&&now-lastFaceAt<850
  game.update(dt,hands,fresh?face:null,fresh)
  if(!lastMonitor||now-lastMonitor>=1000/30-1){monitor.render(game,video,active,dt+(lastMonitor?Math.max(0,(now-lastMonitor)/1000-dt):0));lastMonitor=now}
  scene?.render(game,dt)
  if(!start.hidden&&scene){const center=scene.screenCenter();start.style.left=`${center.x}px`;start.style.top=`${center.y}px`}
  animation=requestAnimationFrame(frame)
}
animation=requestAnimationFrame(frame)
start.addEventListener('click',()=>void startCamera());camera.addEventListener('click',()=>{if(active){stopCamera();start.hidden=false}else void startCamera()})
$('#arcade-reset').addEventListener('click',()=>{game.reset();resetTracking()})
$('#arcade-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen?.()}catch{/* Preserve the camera when fullscreen is unavailable. */}})
addEventListener('resize',()=>scene?.resize());addEventListener('blur',()=>{hands=[];previous.clear()})
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){generation++;resetTracking();clearTimeout(watchdog);cancelAnimationFrame(animation);stream?.getVideoTracks().forEach(t=>t.enabled=false);video.pause()}
  else{lastTime=lastPresent=lastMonitor=0;lastVideoTime=-1;busy=false;if(active){stream?.getVideoTracks().forEach(t=>t.enabled=true);void video.play().catch(()=>fail('카메라를 다시 시작해주세요.'))}cancelAnimationFrame(animation);animation=requestAnimationFrame(frame)}
})
function dispose(){disposed=true;cancelAnimationFrame(animation);stopCamera();scene?.dispose()}
addEventListener('pagehide',dispose,{once:true});addEventListener('pageshow',e=>{if(e.persisted)location.reload()});if(import.meta.hot)import.meta.hot.dispose(dispose)
