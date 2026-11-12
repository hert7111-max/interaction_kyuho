import './style.css'
import { WaterRenderer } from './water-renderer'
import type { Touch } from './water-renderer'
import { cameraToSurface, smoothPoint, TIP_INDICES } from './water-math'
import type { Point } from './water-math'

const icons: Record<string,string> = {
  drop:'<path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  camera:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  hand:'<path d="M7 12V6a2 2 0 0 1 4 0m0 6V4a2 2 0 0 1 4 0v8m0-6a2 2 0 0 1 4 0v8m0-3a2 2 0 0 1 3 1v4c0 4-3 6-7 6h-1c-3 0-5-2-7-4l-4-5a2 2 0 0 1 3-2l3 3"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  play:'<path d="m8 4 12 8-12 8V4Z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3m0 3h.01"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  wave:'<path d="M2 8c3-5 7 5 10 0s7 5 10 0M2 16c3-5 7 5 10 0s7 5 10 0"/>',
  mirror:'<path d="M12 2v20M8 6 3 9v6l5 3V6Zm8 0 5 3v6l-5 3V6Z"/>',
}
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]??''}</svg>`
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<main class="water-app">
  <canvas id="water" aria-label="손끝의 움직임에 따라 물결처럼 굴절되는 카메라 화면"></canvas>
  <video id="camera-video" autoplay muted playsinline aria-hidden="true"></video>
  <canvas id="landmarks" aria-hidden="true"></canvas>
  <div class="vignette" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="./" aria-label="WaterTouch 홈"><span class="brand-symbol">${icon('drop')}</span><span>WaterTouch<span class="brand-period">.</span></span></a>
    <div class="experiment"><span class="hairline"></span>INTERACTION EXPERIMENT<span class="experiment-number">008</span></div>
    <nav class="header-actions" aria-label="화면 도구"><button id="help" class="icon-button" aria-label="사용 방법">${icon('help')}</button><button id="fullscreen" class="icon-button" aria-label="전체 화면">${icon('expand')}</button></nav>
  </header>
  <div class="live-caption"><span class="status-dot" id="status-dot"></span><span id="status-label">WATER SURFACE</span><span class="caption-divider"></span><span id="mode-label">손끝으로 일으키는 작은 변화</span></div>
  <section class="intro" id="intro" aria-labelledby="intro-title">
    <div class="intro-orbit" aria-hidden="true"><i></i><i></i><i></i><span>${icon('drop')}</span><b class="orbit-spark"></b></div>
    <span class="eyebrow">A LITTLE TOUCH. AN ENDLESS RIPPLE.</span>
    <h1 id="intro-title">당신의 손끝에서,<br><em>물결이 시작됩니다.</em></h1>
    <p id="intro-description">익숙한 카메라 화면이 물의 표면으로.<br>양손을 펼치고, 손끝으로 가만히 물살을 그려보세요.</p>
    <button class="primary-button" id="start">${icon('camera')}<span>카메라 시작하기</span>${icon('arrow')}</button>
    <button class="demo-button" id="demo">먼저 물결 체험하기 <span>↗</span></button>
    <p class="permission-note">카메라 영상은 기기에만 머물러요.</p>
    <p class="error" id="error" role="alert"></p>
  </section>
  <div class="experience-hint" id="experience-hint" hidden>${icon('hand')}<span id="hint-text">카메라에 양손을 펼쳐보세요.</span></div>
  <aside class="tracking" aria-label="손 인식 상태"><div class="tracking-heading"><span class="tiny-cross">+</span>LIVE TRACKING</div><div class="tracking-numbers"><strong id="hands-count">0<span>/ 2</span></strong><span>HANDS</span><i></i><strong id="tips-count">0<span>/ 10</span></strong><span>FINGERTIPS</span></div><div class="finger-meters" aria-hidden="true"><span>L</span>${'<i></i>'.repeat(5)}<b></b><span>R</span>${'<i></i>'.repeat(5)}</div></aside>
  <section class="control-panel" aria-label="물결 설정">
    <div class="control-title">${icon('wave')}<span>물결 설정<small>MAKE IT YOUR OWN</small></span></div>
    <label class="slider-control" for="intensity"><span>물결 강도 <output id="intensity-value">65%</output></span><input id="intensity" type="range" min="10" max="100" value="65"/></label>
    <label class="slider-control" for="persistence"><span>물결 여운 <output id="persistence-value">70%</output></span><input id="persistence" type="range" min="0" max="100" value="70"/></label>
    <div class="panel-divider"></div>
    <button id="show-tips" class="toggle-control" aria-pressed="true"><span>손끝 표시</span><span class="switch"></span></button>
    <button id="mirror" class="panel-icon active" aria-pressed="true" aria-label="카메라 좌우 반전">${icon('mirror')}</button>
    <button id="reset" class="panel-icon" aria-label="물결 지우기">${icon('reset')}</button>
    <button id="pause" class="panel-icon" aria-label="카메라 일시정지" disabled>${icon('pause')}</button>
  </section>
  <footer class="footer"><span>MOVE SLOWLY. FEEL THE FLOW.</span><span class="footer-right"><i></i>MEDIAPIPE HAND TRACKING<span>×</span>REAL-TIME WATER</span></footer>
  <div id="toast" class="toast" role="status"></div>
</main>
<dialog id="help-dialog"><button id="close-help" class="icon-button close-help" aria-label="닫기">${icon('close')}</button><span class="eyebrow">HOW TO WATERTOUCH</span><h2>손끝으로, 물결을 그려요.</h2><ol><li><b>카메라를 켜주세요.</b><span>브라우저의 카메라 접근 요청을 허용해주세요.</span></li><li><b>양손을 화면에 펼쳐주세요.</b><span>엄지부터 새끼손가락까지, 양손의 손끝 10개를 추적해요. 밝은 곳에서 손 전체가 보이면 더 잘 인식해요.</span></li><li><b>천천히 물살을 가르세요.</b><span>손끝에서 물결이 퍼지고, 움직이는 길을 따라 화면이 굴절돼요. 강도와 여운을 조절해보세요.</span></li></ol><p>‘먼저 물결 체험하기’에서는 마우스나 터치로 물결을 만들 수 있어요. 카메라는 HTTPS 또는 localhost에서 사용할 수 있어요.</p></dialog>`
const $=<T extends HTMLElement>(selector:string)=>document.querySelector<T>(selector)!
const video=$<HTMLVideoElement>('#camera-video')
const canvas=$<HTMLCanvasElement>('#water')
const overlay=$<HTMLCanvasElement>('#landmarks')
const ctx=overlay.getContext('2d')!
const start=$<HTMLButtonElement>('#start')
const pause=$<HTMLButtonElement>('#pause')
let water: WaterRenderer
try { water=new WaterRenderer(canvas,video) }
catch(error){$('#error').textContent=String(error);start.disabled=true;throw error}
let stream:MediaStream|null=null,worker:Worker|null=null,workerReady=false,busy=false,starting=false,active=false,paused=false,demo=false,showTips=true,disposed=false
let generation=0,lastFrameAt=0,lastVideoTime=-1,previousTrackingTime=0,trackingTimeout=0,animation=0,lastDetectedAt=0
let workerInitReject:((error:Error)=>void)|null=null
let toastTimer:ReturnType<typeof setTimeout>|undefined
const previous=new Map<string,Point>()
let tips: {point:Point;side:string}[]=[]
let pointer:Point|null=null
const fingerMeters=[...document.querySelectorAll<HTMLElement>('.finger-meters i')]
function toast(message:string){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600)}
function setStatus(label:string,live=false){$('#status-label').textContent=label;$('#status-dot').classList.toggle('live',live)}
function resetTracking(){previous.clear();tips=[];previousTrackingTime=0;$('#hands-count').innerHTML='0<span>/ 2</span>';$('#tips-count').innerHTML='0<span>/ 10</span>';fingerMeters.forEach(el=>el.classList.remove('detected'))}
function setExperience(){ $('#intro').hidden=true;$('#experience-hint').hidden=false;document.body.classList.add('experiencing') }
function updatePause(){pause.innerHTML=icon(paused?'play':'pause');pause.setAttribute('aria-label',paused?'카메라 다시 시작':'카메라 일시정지');pause.classList.toggle('active',paused)}
function stopCamera(){
  generation++;workerReady=false;busy=false;active=false
  stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null
  worker?.terminate();worker=null;water.cameraReady=false;resetTracking();clearTimeout(trackingTimeout)
}
function loadTracker():Promise<void>{
  return new Promise((resolve,reject)=>{
    workerInitReject=reject
    // Classic worker keeps MediaPipe's WASM loader compatible in development and production.
    worker=new Worker(new URL(`${import.meta.env.BASE_URL}hand-tracker.js`,location.href))
    const timeout=setTimeout(()=>{workerInitReject=null;reject(new Error('손 인식 모델을 불러오는 데 시간이 오래 걸려요. 다시 시도해주세요.'))},45000)
    worker.onerror=()=>{
      clearTimeout(timeout)
      if(workerInitReject){workerInitReject=null;reject(new Error('손 인식 엔진을 시작하지 못했어요. 최신 Chrome 또는 Safari에서 다시 시도해주세요.'))}
      else trackingError()
    }
    worker.onmessage=event=>{
      if(event.data.type==='ready'){clearTimeout(timeout);workerReady=true;workerInitReject=null;resolve()}
      else if(event.data.type==='error'){
        clearTimeout(timeout)
        console.error('MediaPipe:',event.data.message)
        if(workerInitReject){workerInitReject=null;reject(new Error('손 인식 모델을 불러오지 못했어요. 새로고침 후 다시 시도해주세요.'))}
        else trackingError()
      }else if(event.data.type==='hands'){
        busy=false
        if(event.data.generation!==generation||!active||paused)return
        receiveHands(event.data)
      }
    }
    worker.postMessage({type:'init',base:new URL(import.meta.env.BASE_URL,location.href).href})
  })
}
function trackingError(){
  stopCamera();setStatus('TRACKING UNAVAILABLE');$('#intro').hidden=false;$('#experience-hint').hidden=true;start.disabled=false;start.querySelector('span')!.textContent='다시 시작하기';$('#error').textContent='손 인식이 중단됐어요. 카메라를 다시 시작해주세요.';pause.disabled=true
}
async function startCamera(){
  if(starting)return
  starting=true;start.disabled=true;$('#error').textContent='';start.querySelector('span')!.textContent='카메라 연결 중…'
  try{
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('카메라는 HTTPS 또는 localhost 주소에서 사용할 수 있어요.')
    stopCamera();demo=false;paused=false
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}})
    if(disposed){stream.getTracks().forEach(t=>t.stop());return}
    video.srcObject=stream;await video.play();water.cameraReady=true
    start.querySelector('span')!.textContent='손 인식 준비 중…';setStatus('LOADING HAND TRACKING')
    await loadTracker()
    active=true;lastVideoTime=-1;setExperience();pause.disabled=false;updatePause();setStatus('CAMERA LIVE',true)
    $('#mode-label').textContent='양손 · 10개의 손끝 · 무한한 물결';$('#hint-text').textContent='카메라에 양손을 펼쳐보세요.'
    stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(active)trackingError()})
  }catch(error){
    stopCamera();$('#intro').hidden=false;$('#experience-hint').hidden=true;pause.disabled=true
    const name=error instanceof Error?error.name:''
    $('#error').textContent=name==='NotAllowedError'?'카메라 접근이 허용되지 않았어요. 브라우저의 카메라 권한을 허용한 뒤 다시 눌러주세요.':name==='NotFoundError'?'연결된 카메라를 찾지 못했어요. 카메라 연결을 확인해주세요.':name==='NotReadableError'?'카메라를 사용할 수 없어요. 다른 앱에서 카메라를 사용 중인지 확인해주세요.':error instanceof Error?error.message:'카메라를 시작하지 못했어요.'
    setStatus('CAMERA OFF')
  }finally{starting=false;start.disabled=false;start.querySelector('span')!.textContent='카메라 시작하기'}
}
start.addEventListener('click',()=>void startCamera())
$('#demo').addEventListener('click',()=>{
  if(starting)return
  stopCamera();demo=true;paused=false;setExperience();setStatus('PLAYGROUND',true);$('#mode-label').textContent='마우스와 터치로 미리 만나는 물결';$('#hint-text').innerHTML='화면을 드래그해 물결을 그려보세요. <button id="demo-camera">카메라 켜기 ↗</button>';$('#demo-camera').addEventListener('click',()=>void startCamera());pause.disabled=true
  water.disturb([{from:{x:.5,y:.5},to:{x:.5,y:.5},strength:.65}])
})
function receiveHands(data:{landmarks:{x:number;y:number}[][];handedness:{categoryName:string}[][];timestamp:number}){
  lastDetectedAt=performance.now()
  const dt=previousTrackingTime?Math.min(.1,(data.timestamp-previousTrackingTime)/1000):1/30
  previousTrackingTime=data.timestamp
  const nextTips:typeof tips=[],touches:Touch[]=[],seen=new Set<string>(),usedSides=new Set<string>()
  fingerMeters.forEach(el=>el.classList.remove('detected'))
  for(const [handIndex,landmarks] of data.landmarks.entries()){
    // Match the previous wrist by position to avoid swapping trails when result order changes.
    const wrist=landmarks[0]!
    let side=data.handedness[handIndex]?.[0]?.categoryName??(handIndex?'Right':'Left')
    const available=['Left','Right'].filter(s=>!usedSides.has(s)&&previous.has(`${s}-wrist`))
    const nearest=available.sort((a,b)=>Math.hypot(previous.get(`${a}-wrist`)!.x-wrist.x,previous.get(`${a}-wrist`)!.y-wrist.y)-Math.hypot(previous.get(`${b}-wrist`)!.x-wrist.x,previous.get(`${b}-wrist`)!.y-wrist.y))[0]
    if(nearest&&Math.hypot(previous.get(`${nearest}-wrist`)!.x-wrist.x,previous.get(`${nearest}-wrist`)!.y-wrist.y)<.25)side=nearest
    if(usedSides.has(side))side=side==='Left'?'Right':'Left'
    usedSides.add(side);previous.set(`${side}-wrist`,wrist);seen.add(`${side}-wrist`)
    for(const [index,tip] of TIP_INDICES.entries()){
      const point=cameraToSurface(landmarks[tip]!,video.videoWidth/video.videoHeight,water.aspect,water.mirror)
      const key=`${side}-${tip}`,last=previous.get(key),next=last?smoothPoint(last,point,dt):point
      previous.set(key,next);seen.add(key)
      // Off-screen fingers are tracked but do not disturb the cropped surface.
      if(next.x<0||next.x>1||next.y<0||next.y>1)continue
      const distance=last?Math.hypot((next.x-last.x)*water.aspect,next.y-last.y):0
      const reappeared=!last||distance>.22
      const strength=reappeared ? .28 : Math.min(.55,.018+distance/dt*.16)*Math.min(dt*30,2)
      touches.push({from:reappeared?next:last!,to:next,strength})
      nextTips.push({point:next,side})
      fingerMeters[(side==='Left'?0:5)+index]!.classList.add('detected')
    }
  }
  for(const key of previous.keys())if(!seen.has(key))previous.delete(key)
  tips=nextTips;water.disturb(touches)
  $('#hands-count').innerHTML=`${data.landmarks.length}<span>/ 2</span>`
  $('#tips-count').innerHTML=`${nextTips.length}<span>/ 10</span>`
  $('#hint-text').textContent=data.landmarks.length?'손끝을 천천히 움직여 물살을 그려보세요.':'카메라에 양손을 펼쳐보세요.'
}
async function captureFrame(now:number){
  if(!active||paused||busy||!workerReady||video.readyState<2||document.hidden||now-lastFrameAt<33||lastVideoTime===video.currentTime)return
  busy=true;lastFrameAt=now;lastVideoTime=video.currentTime
  const currentGeneration=generation
  try{
    const bitmap=await createImageBitmap(video,{resizeWidth:640,resizeHeight:Math.round(640*video.videoHeight/video.videoWidth)})
    if(currentGeneration!==generation||!worker||paused){bitmap.close();busy=false;return}
    worker.postMessage({type:'frame',bitmap,timestamp:now,generation:currentGeneration},[bitmap])
    clearTimeout(trackingTimeout);trackingTimeout=window.setTimeout(()=>{if(active&&!paused)trackingError()},10000)
  }catch{busy=false;if(active)trackingError()}
}
function resize(){water.resize();overlay.width=innerWidth*devicePixelRatio;overlay.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);resetTracking()}
addEventListener('resize',resize);resize()
function frame(now:number){
  if(disposed)return
  if(!document.hidden){
    void captureFrame(now)
    if(active&&!paused&&lastDetectedAt&&now-lastDetectedAt>450)resetTracking()
    water.render(now,video.videoWidth&&video.videoHeight?video.videoWidth/video.videoHeight:16/9)
    ctx.clearRect(0,0,innerWidth,innerHeight)
    if(showTips&&!paused)for(const {point,side} of tips){
      const x=point.x*innerWidth,y=(1-point.y)*innerHeight
      ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=side==='Left'?'#9edbd2cc':'#ecddbdcc';ctx.fill();ctx.strokeStyle='#ffffff65';ctx.lineWidth=1;ctx.stroke()
      ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.strokeStyle=side==='Left'?'#a3e5d538':'#ecddbd38';ctx.stroke()
    }
  }
  animation=requestAnimationFrame(frame)
}
animation=requestAnimationFrame(frame)
const intensity=$<HTMLInputElement>('#intensity'),persistence=$<HTMLInputElement>('#persistence')
function settings(){water.intensity=Number(intensity.value)/65;water.persistence=.96+Number(persistence.value)*.0004;$('#intensity-value').textContent=`${intensity.value}%`;$('#persistence-value').textContent=`${persistence.value}%`}
intensity.addEventListener('input',settings);persistence.addEventListener('input',settings);settings()
$('#show-tips').addEventListener('click',()=>{showTips=!showTips;$('#show-tips').setAttribute('aria-pressed',String(showTips))})
$('#mirror').addEventListener('click',()=>{water.mirror=!water.mirror;$('#mirror').setAttribute('aria-pressed',String(water.mirror));$('#mirror').classList.toggle('active',water.mirror);resetTracking();water.clear();toast(water.mirror?'거울 모드가 켜졌어요.':'거울 모드가 꺼졌어요.')})
$('#reset').addEventListener('click',()=>{water.clear();resetTracking();toast('수면을 고요하게 정리했어요.')})
pause.addEventListener('click',()=>{
  if(!active)return
  paused=!paused;generation++;resetTracking();clearTimeout(trackingTimeout)
  if(paused){video.pause();stream?.getVideoTracks().forEach(track=>track.enabled=false);setStatus('CAMERA PAUSED');$('#hint-text').textContent='카메라가 잠시 멈췄어요.'}
  else{stream?.getVideoTracks().forEach(track=>track.enabled=true);void video.play().catch(()=>trackingError());setStatus('CAMERA LIVE',true);$('#hint-text').textContent='카메라에 양손을 펼쳐보세요.'}
  updatePause()
})
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('이 브라우저에서는 전체 화면을 지원하지 않아요.')}catch{toast('전체 화면으로 전환하지 못했어요.')}})
const help=$<HTMLDialogElement>('#help-dialog')
$('#help').addEventListener('click',()=>help.showModal());$('#close-help').addEventListener('click',()=>help.close());help.addEventListener('click',e=>{if(e.target===help)help.close()})
function pointerPosition(e:PointerEvent):Point{return{x:e.clientX/innerWidth,y:1-e.clientY/innerHeight}}
canvas.addEventListener('pointerdown',e=>{if(!demo)return;pointer=pointerPosition(e);canvas.setPointerCapture(e.pointerId);water.disturb([{from:pointer,to:pointer,strength:.5}])})
canvas.addEventListener('pointermove',e=>{if(!demo||!pointer)return;const next=pointerPosition(e);water.disturb([{from:pointer,to:next,strength:.3}]);pointer=next})
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{pointer=null})
document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;resetTracking();clearTimeout(trackingTimeout)}else{lastVideoTime=-1;lastDetectedAt=0}})
function dispose(){disposed=true;cancelAnimationFrame(animation);stopCamera();water.dispose();clearTimeout(toastTimer)}
addEventListener('pagehide',dispose,{once:true})
addEventListener('pageshow',event=>{if(event.persisted)location.reload()})
if(import.meta.hot)import.meta.hot.dispose(dispose)
