import './particle.css'
import {FingertipDatamosh,fingertipRadius} from './particle-engine'
import type {Point} from './particle-engine'
import {ParticleRenderer} from './particle-renderer'
import {ParticleTracking} from './particle-tracking'
import type {Tracking} from './particle-tracking'
import {cameraToSurface,TIP_INDICES} from './water-math'
const paths:Record<string,string>={camera:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',off:'<path d="m3 3 18 18M9 6l1-3h4l2 3h2a3 3 0 0 1 3 3v8M6 6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12M9 10a4 4 0 0 0 5 5"/>',reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'}
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`<main class="particle-app"><video id="particle-video" autoplay muted playsinline aria-hidden="true"></video><canvas id="particle-canvas" aria-label="화면 어디서나 손끝 주변이 강한 컬러 데이터모쉬와 영문 숫자 코드로 붕괴되는 카메라 화면"></canvas><div class="particle-shade"></div><button id="particle-start" class="particle-start" aria-label="카메라 시작">${icon('camera')}</button><div class="particle-controls" role="group" aria-label="화면 조작"><button id="particle-camera" aria-label="카메라 시작" aria-pressed="false">${icon('camera')}</button><button id="particle-reset" aria-label="글리치 지우기">${icon('reset')}</button><button id="particle-fullscreen" aria-label="전체 화면">${icon('expand')}</button></div><div id="particle-error" class="particle-error" role="alert"></div></main>`
const $=<T extends HTMLElement>(selector:string)=>document.querySelector<T>(selector)!
const video=$<HTMLVideoElement>('#particle-video'),canvas=$<HTMLCanvasElement>('#particle-canvas'),start=$<HTMLButtonElement>('#particle-start'),camera=$<HTMLButtonElement>('#particle-camera')
const engine=new FingertipDatamosh()
engine.aspect=innerWidth/innerHeight
let renderer:ParticleRenderer|null=null
try{renderer=new ParticleRenderer(canvas,video,engine)}catch{$('#particle-error').textContent='WebGL 화면을 준비하지 못했어요. 최신 Chrome 또는 Safari에서 다시 열어주세요.';start.disabled=camera.disabled=true}
let stream:MediaStream|null=null,tracker:ParticleTracking|null=null,active=false,loading=false,busy=false,disposed=false,generation=0,lastCapture=0,lastVideoTime=-1,lastHandAt=0,lastTime=0,lastPresent=0,animation=0,watchdog=0
const fingers=new Map<string,{point:Point;time:number}>()
function reset(){engine.reset();fingers.clear();renderer?.invalidate()}
function resetTracking(){reset();lastHandAt=0}
function updateCameraButton(){camera.innerHTML=icon(active?'off':'camera');camera.setAttribute('aria-label',active?'카메라 끄기':'카메라 시작');camera.setAttribute('aria-pressed',String(active))}
function stopCamera(){generation++;active=busy=false;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;tracker?.close();tracker=null;clearTimeout(watchdog);resetTracking();if(renderer)renderer.ready=false;updateCameraButton()}
function fail(message:string){stopCamera();start.hidden=false;$('#particle-error').textContent=message}
async function startCamera(){
  if(loading||!renderer)return
  loading=true;start.disabled=camera.disabled=true;start.hidden=false;start.classList.add('loading');$('#particle-error').textContent=''
  try{
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('카메라는 HTTPS 또는 localhost에서 사용할 수 있어요.')
    stopCamera()
    const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}})
    if(disposed){next.getTracks().forEach(track=>track.stop());return}
    stream=next;video.srcObject=stream;await video.play();renderer.ready=true
    const tracking=new ParticleTracking();tracker=tracking
    await tracking.init(new URL(import.meta.env.BASE_URL,location.href).href)
    if(disposed||tracker!==tracking){tracking.close();return}
    tracking.onresult=data=>{busy=false;clearTimeout(watchdog);if(data.generation===generation&&active)receive(data)}
    tracking.onerror=()=>fail('손 인식이 중단됐어요. 카메라를 다시 켜주세요.')
    active=true;lastVideoTime=-1;start.hidden=true;updateCameraButton()
    if(document.hidden){stream.getVideoTracks().forEach(track=>track.enabled=false);video.pause()}
    stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(active)fail('카메라 연결이 끊겼어요.')})
  }catch(error){
    const name=error instanceof Error?error.name:''
    fail(name==='NotAllowedError'?'브라우저와 OS의 카메라 권한을 허용한 뒤 다시 눌러주세요.':name==='NotFoundError'?'연결된 카메라를 찾지 못했어요.':name==='NotReadableError'?'다른 앱에서 카메라를 사용 중인지 확인해주세요.':error instanceof Error?error.message:'카메라를 시작하지 못했어요.')
  }finally{loading=false;start.disabled=camera.disabled=false;start.classList.remove('loading')}
}
function map(point:Point){return cameraToSurface(point,video.videoWidth/video.videoHeight,innerWidth/innerHeight,true)}
function receive(data:Tracking){
  const now=performance.now()
  lastHandAt=now
  const seen=new Set<string>(),sides=new Set<string>()
  for(const [handIndex,hand]of data.landmarks.entries()){
    let side=data.handedness[handIndex]?.[0]?.categoryName??String(handIndex);if(sides.has(side))side+=handIndex;sides.add(side)
    for(const index of TIP_INDICES){
      const tip=hand[index],joint=hand[index-1];if(!tip||!joint)continue
      const key=`${side}-${index}`,point=map(tip),last=fingers.get(key)
      const radius=fingertipRadius(point,map(joint),engine.aspect,innerHeight)
      engine.touch(point,last&&now-last.time<180?last.point:null,radius)
      fingers.set(key,{point,time:now});seen.add(key)
    }
  }
  for(const id of fingers.keys())if(!seen.has(id))fingers.delete(id)
}
async function capture(now:number){
  if(!active||!tracker||busy||video.readyState<2||document.hidden||lastVideoTime===video.currentTime||now-lastCapture<tracker.budget.interval)return
  busy=true;lastCapture=now;lastVideoTime=video.currentTime;const token=generation,current=tracker
  clearTimeout(watchdog);watchdog=window.setTimeout(()=>{if(active)fail('인식이 멈췄어요. 카메라를 다시 켜주세요.')},12000)
  try{await current.frame(video,now,token)}catch{if(token===generation){busy=false;if(active)fail('카메라 영상을 읽지 못했어요. 외부 브라우저에서 다시 시도해주세요.')}}
}
function frame(now:number){
  if(disposed||document.hidden)return
  if(lastPresent&&now-lastPresent<1000/60-.75){animation=requestAnimationFrame(frame);return}
  lastPresent=now-((now-lastPresent)%(1000/60))
  const dt=lastTime?Math.min(.06,(now-lastTime)/1000):1/60;lastTime=now
  void capture(now)
  if(active&&now-lastHandAt>400)fingers.clear()
  engine.update(dt);renderer?.render(video.videoWidth&&video.videoHeight?video.videoWidth/video.videoHeight:16/9)
  animation=requestAnimationFrame(frame)
}
animation=requestAnimationFrame(frame)
start.addEventListener('click',()=>void startCamera())
camera.addEventListener('click',()=>{if(active){stopCamera();start.hidden=false}else void startCamera()})
$('#particle-reset').addEventListener('click',reset)
$('#particle-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen?.()}catch{/* Keep the camera running when fullscreen is unavailable. */}})
addEventListener('resize',()=>{engine.aspect=innerWidth/innerHeight;resetTracking();renderer?.resize()})
addEventListener('blur',()=>fingers.clear())
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){generation++;resetTracking();clearTimeout(watchdog);cancelAnimationFrame(animation);stream?.getVideoTracks().forEach(track=>track.enabled=false);video.pause()}
  else{lastTime=lastPresent=0;lastVideoTime=-1;busy=false;if(active){stream?.getVideoTracks().forEach(track=>track.enabled=true);void video.play().catch(()=>fail('카메라를 다시 시작해주세요.'))}cancelAnimationFrame(animation);animation=requestAnimationFrame(frame)}
})
function dispose(){disposed=true;cancelAnimationFrame(animation);stopCamera();renderer?.dispose()}
addEventListener('pagehide',dispose,{once:true});addEventListener('pageshow',event=>{if(event.persisted)location.reload()})
if(import.meta.hot)import.meta.hot.dispose(dispose)
