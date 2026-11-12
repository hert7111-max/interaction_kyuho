import './snow.css'
import { SnowScene } from './snow-scene'
import { isMouthOpen } from './snow-physics'
import type { Vec } from './snow-physics'
import { cameraToSurface, smoothPoint } from './water-math'
const paths:Record<string,string>={
 snow:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l4-2-1-5m15 9-4 2 1 5"/>',
 camera:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 cloud:'<path d="M7 18a5 5 0 1 1 1-10 6 6 0 0 1 11 2 4 4 0 0 1-1 8H7Z"/><path d="M8 21h.01M12 23h.01M17 21h.01"/>',
 hand:'<path d="M9 13V4a2 2 0 0 1 4 0v7l4 1c3 1 3 3 2 5l-2 4H9l-5-7c-1-2 1-3 2-2l3 2"/>',
 breath:'<path d="M3 8h11c6 0 6-6 2-6-2 0-3 1-3 2M3 12h15c6 0 5 8 1 8-2 0-3-1-3-3M3 16h6"/>',
 reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 0-1 1-1 2m0 3h.01"/>',
 expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 body:'<circle cx="12" cy="6" r="3"/><path d="M4 22v-3a8 8 0 0 1 16 0v3M2 3V1h3m14 0h3v3M1 19v4h4m14 0h4v-4"/>',
 stop:'<rect x="5" y="5" width="14" height="14" rx="3"/>',
}
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??''}</svg>`
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<main class="snow-app">
  <div class="snow-backdrop"></div><video id="snow-video" autoplay muted playsinline aria-hidden="true"></video>
  <canvas id="snow-fog" aria-label="입김이 서리고 검지로 지울 수 있는 유리"></canvas>
  <canvas id="snow-world" aria-label="구름을 검지로 찌르면 사람의 윤곽에 눈이 쌓이는 화면"></canvas>
  <div class="snow-vignette" aria-hidden="true"></div>
  <header class="snow-header"><a class="snow-brand" href="./?example=snow">${icon('snow')}<span>Snow<span class="snow-brand-dot">.</span></span></a><div class="snow-tools"><button id="snow-help" class="snow-icon" aria-label="사용 방법">${icon('help')}</button><button id="snow-fullscreen" class="snow-icon" aria-label="전체 화면">${icon('expand')}</button></div></header>
  <div class="snow-caption"><span id="snow-status-dot"></span><span id="snow-status">WINTER, ON CAMERA</span><i></i><span id="snow-caption-copy">작은 구름, 나만의 겨울</span></div>
  <div class="snow-cloud-hint" id="cloud-hint">구름을 <span>톡</span> 건드려보세요 <span class="hint-spark">✳</span></div>
  <section class="snow-intro" id="snow-intro" aria-labelledby="snow-title">
    <span class="snow-eyebrow">A LITTLE CLOUD. A MOMENT OF WINTER.</span>
    <h1 id="snow-title">겨울이,<br><em>당신에게 내려요.</em></h1>
    <p>손끝으로 눈을 부르고, 어깨 위에 겨울을 쌓고.<br>입김이 서린 화면에는 작은 그림을 남겨보세요.</p>
    <button id="snow-start" class="snow-primary">${icon('camera')}<span>카메라 시작하기</span>${icon('arrow')}</button>
    <button id="snow-demo" class="snow-demo-link">카메라 없이 먼저 체험하기 <span>↗</span></button>
    <small>영상은 기기 안에서만 처리돼요.</small><p id="snow-error" class="snow-error" role="alert"></p>
  </section>
  <div id="snow-live-hint" class="snow-live-hint" hidden>${icon('hand')}<span id="snow-hint-text">검지를 구름 가까이 가져가보세요.</span><button id="demo-start-camera" hidden>카메라 켜기 ↗</button></div>
  <div class="snow-stats" id="snow-stats"><span class="snow-stats-title"><i></i>YOUR LITTLE WINTER</span><div><span><b id="snow-count">0</b>눈송이</span><span class="snow-stat-divider"></span><span><b id="snow-resting">0</b>쌓인 눈</span></div><span id="snow-tracking-info" class="snow-tracking-info">카메라를 켜면 나의 겨울이 시작돼요</span></div>
  <div class="snow-demo-tools" id="snow-demo-tools" hidden><button id="demo-breathe">${icon('breath')}<span>꾹 눌러 입김 불기</span></button><span>구름 클릭 · 화면 드래그로 김 지우기</span></div>
  <section class="snow-dock" aria-label="겨울 설정">
    <div class="snow-dock-label">${icon('snow')}<span>나의 겨울<small>LET IT SNOW</small></span></div>
    <label class="snow-range" for="snow-density"><span>눈의 양 <output id="snow-density-value">65%</output></span><input id="snow-density" type="range" min="10" max="100" value="65"/></label>
    <label class="snow-range" for="snow-wind"><span>바람 <output id="snow-wind-value">고요하게</output></span><input id="snow-wind" type="range" min="-100" max="100" value="0"/></label>
    <i class="snow-dock-divider"></i>
    <button id="snow-contour" class="snow-text-toggle" aria-pressed="false">${icon('body')}<span>윤곽 보기</span></button>
    <button id="snow-reset" class="snow-icon" aria-label="눈과 입김 지우기">${icon('reset')}</button>
    <button id="snow-stop" class="snow-icon" aria-label="카메라 끄기" disabled>${icon('stop')}</button>
  </section>
  <div class="snow-steps" id="snow-steps"><span><b>01</b> 검지로 구름을 톡</span><i></i><span><b>02</b> 몸 위로 소복소복</span><i></i><span><b>03</b> 입김 위에 그리는 낙서</span></div>
  <footer class="snow-footer"><span>A SOFTER KIND OF INTERACTION.</span><span>HUMANSEG <i>×</i> HAND & FACE TRACKING</span></footer>
  <div id="snow-toast" class="snow-toast" role="status"></div>
</main>
<dialog id="snow-help-dialog" class="snow-dialog"><button id="snow-close-help" class="snow-icon snow-close" aria-label="닫기">${icon('close')}</button><span class="snow-eyebrow">A FEW LITTLE WINTER TRICKS</span><h2>나만의 겨울을 만나는 법.</h2><ol><li><b>검지로 구름을 찔러보세요.</b><p>양손의 검지를 추적해요. 구름에 닿으면 잠시 눈이 내려요. 한 번 더 건드리면 눈이 내리는 시간을 늘릴 수 있어요.</p></li><li><b>머리와 어깨 위에, 소복하게.</b><p>카메라 속 사람의 윤곽을 따라 눈이 부딪치고 쌓여요. 가파른 곳에서는 미끄러지고, 몸을 움직이면 받침을 잃은 눈이 떨어져요.</p></li><li><b>입을 벌려 입김을 불어보세요.</b><p>눈이 내릴 때 입 주변에 김이 서려요. 검지로 김을 지우며 그림을 그릴 수 있고, 남은 김은 천천히 사라져요.</p></li></ol><p class="snow-dialog-note">밝은 곳에서 얼굴과 손, 상반신이 보이게 서주세요. 카메라는 HTTPS 또는 localhost에서 사용할 수 있어요. 체험 모드에서는 마우스·터치와 ‘입김 불기’ 버튼을 사용해요.</p></dialog>`
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!
const video=$<HTMLVideoElement>('#snow-video'),canvas=$<HTMLCanvasElement>('#snow-world'),start=$<HTMLButtonElement>('#snow-start'),stop=$<HTMLButtonElement>('#snow-stop')
const scene=new SnowScene(canvas,$<HTMLCanvasElement>('#snow-fog'),video)
let stream:MediaStream|null=null,worker:Worker|null=null,ready=false,busy=false,starting=false,disposed=false
let generation=0,lastCapture=0,lastVideoTime=-1,lastTimestamp=0,lastTipTime=0,animation=0,watchdog=0
let initReject:((error:Error)=>void)|null=null
const smoothed=new Map<string,Vec>()
let toastTimer:ReturnType<typeof setTimeout>|undefined
function toast(text:string){$('#snow-toast').textContent=text;$('#snow-toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#snow-toast').classList.remove('visible'),2700)}
function status(text:string,live=false){$('#snow-status').textContent=text;$('#snow-status-dot').classList.toggle('live',live)}
function showExperience(demo=false){$('#snow-intro').hidden=true;$('#snow-live-hint').hidden=false;$('#snow-demo-tools').hidden=!demo;$('#demo-start-camera').hidden=!demo;$('#snow-steps').hidden=true;$('#cloud-hint').hidden=true;document.body.classList.add('snow-experiencing')}
function stopCamera(){generation++;ready=false;busy=false;scene.live=false;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;video.classList.remove('on');worker?.terminate();worker=null;clearTimeout(watchdog);scene.resetTracking();smoothed.clear();stop.disabled=true}
function trackingError(){stopCamera();scene.clear();$('#snow-intro').hidden=false;$('#snow-live-hint').hidden=true;$('#snow-demo-tools').hidden=true;$('#snow-error').textContent='인식이 중단됐어요. 카메라를 다시 시작해주세요.';status('CAMERA OFF');document.body.classList.remove('snow-experiencing')}
function loadTracker(){return new Promise<void>((resolve,reject)=>{
  initReject=reject
  worker=new Worker(new URL(`${import.meta.env.BASE_URL}snow-tracker.js`,location.href))
  const timeout=setTimeout(()=>{initReject=null;reject(new Error('인식 모델을 준비하는 데 시간이 오래 걸려요. 새로고침 후 다시 시도해주세요.'))},75000)
  worker.onerror=()=>{clearTimeout(timeout);if(initReject){initReject=null;reject(new Error('인식 엔진을 시작하지 못했어요. 최신 Chrome 또는 Safari에서 다시 시도해주세요.'))}else trackingError()}
  worker.onmessage=({data})=>{
    if(data.type==='progress')start.querySelector('span')!.textContent=data.stage
    if(data.type==='ready'){clearTimeout(timeout);ready=true;initReject=null;resolve()}
    if(data.type==='error'){console.error('Snow MediaPipe:',data.message);clearTimeout(timeout);if(initReject){initReject=null;reject(new Error('손·얼굴·몸 인식 모델을 불러오지 못했어요. 다시 시도해주세요.'))}else trackingError()}
    if(data.type==='tracking'){
      busy=false;clearTimeout(watchdog)
      if(data.generation!==generation||!scene.live)return
      receiveTracking(data)
    }
  }
  worker.postMessage({type:'init',base:new URL(import.meta.env.BASE_URL,location.href).href})
})}
async function startCamera(){
  if(starting)return
  starting=true;start.disabled=true;$('#snow-demo').setAttribute('disabled','');$('#snow-error').textContent='';start.querySelector('span')!.textContent='카메라 연결 중…'
  try{
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('카메라는 HTTPS 또는 localhost에서 사용할 수 있어요.')
    stopCamera();scene.demo=false;scene.clear()
    const nextStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:960},height:{ideal:540},frameRate:{ideal:30,max:30}}})
    if(disposed){nextStream.getTracks().forEach(t=>t.stop());return}
    stream=nextStream;video.srcObject=stream;await video.play();video.classList.add('on');status('PREPARING YOUR WINTER')
    await loadTracker()
    if(disposed)return
    scene.live=true;scene.lastHumanAt=performance.now();scene.lastTrackingAt=performance.now();scene.mirror=true;lastVideoTime=-1;smoothed.clear();lastTipTime=0;stop.disabled=false
    showExperience();status('CAMERA LIVE',true);$('#snow-caption-copy').textContent='손끝 · 몸의 윤곽 · 입김';$('#snow-hint-text').textContent='검지를 구름 가까이 가져가보세요.'
    stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(scene.live)trackingError()})
  }catch(error){
    stopCamera();$('#snow-intro').hidden=false;$('#snow-live-hint').hidden=true;$('#snow-demo-tools').hidden=true
    const name=error instanceof Error?error.name:''
    $('#snow-error').textContent=name==='NotAllowedError'?'카메라 권한을 허용한 뒤 다시 눌러주세요.':name==='NotFoundError'?'카메라를 찾지 못했어요. 연결을 확인해주세요.':name==='NotReadableError'?'다른 앱에서 카메라를 사용 중인지 확인해주세요.':error instanceof Error?error.message:'카메라를 시작하지 못했어요.'
    status('CAMERA OFF')
  }finally{starting=false;start.disabled=false;$('#snow-demo').removeAttribute('disabled');start.querySelector('span')!.textContent='카메라 시작하기'}
}
type Landmark={x:number;y:number}
type Tracking={landmarks:Landmark[][];handedness:{categoryName:string}[][];faces:Landmark[][]|null;jaw:number|null;mask:Float32Array|null;maskWidth:number;maskHeight:number;timestamp:number}
function toWorld(point:Landmark){const mapped=cameraToSurface(point,video.videoWidth/video.videoHeight,innerWidth/innerHeight,scene.mirror);return{x:mapped.x*scene.worldWidth,y:(1-mapped.y)*900}}
function receiveTracking(data:Tracking){
  const dt=lastTipTime?Math.min(.15,(data.timestamp-lastTipTime)/1000):.05;lastTipTime=data.timestamp
  const seen=new Set<string>()
  const tips=data.landmarks.map((landmarks,index)=>{
    let id=data.handedness[index]?.[0]?.categoryName??String(index);if(seen.has(id))id+=index;seen.add(id)
    const target=toWorld(landmarks[8]!),last=smoothed.get(id)
    const normalizedLast=last?{x:last.x/scene.worldWidth,y:last.y/900}:null,normalizedTarget={x:target.x/scene.worldWidth,y:target.y/900}
    const filtered=normalizedLast?smoothPoint(normalizedLast,normalizedTarget,dt):normalizedTarget
    const tip={id,x:filtered.x*scene.worldWidth,y:filtered.y*900};smoothed.set(id,tip);return tip
  }).filter(tip=>tip.x>=0&&tip.x<=scene.worldWidth&&tip.y>=0&&tip.y<=900)
  for(const id of smoothed.keys())if(!seen.has(id))smoothed.delete(id)
  scene.setTips(tips)
  if(data.mask)scene.setMask(data.mask,data.maskWidth,data.maskHeight,video.videoWidth/video.videoHeight)
  if(data.faces!==null){
    const face=data.faces[0]
    if(face){
      const top=toWorld(face[13]!),bottom=toWorld(face[14]!),left=toWorld(face[78]!),right=toWorld(face[308]!),width=Math.hypot(left.x-right.x,left.y-right.y)
      scene.mouth={x:(top.x+bottom.x)/2,y:(top.y+bottom.y)/2,width,open:isMouthOpen(Math.hypot(top.x-bottom.x,top.y-bottom.y),width,data.jaw??0,scene.mouth?.open)}
    }else scene.mouth=null
  }
}
async function captureFrame(now:number){
  if(!scene.live||busy||!ready||video.readyState<2||document.hidden||now-lastCapture<50||lastVideoTime===video.currentTime)return
  busy=true;lastCapture=now;lastVideoTime=video.currentTime
  const token=generation
  try{
    const bitmap=await createImageBitmap(video,{resizeWidth:640,resizeHeight:Math.round(640*video.videoHeight/video.videoWidth)})
    if(token!==generation||!worker){bitmap.close();busy=false;return}
    worker.postMessage({type:'frame',bitmap,timestamp:now,generation:token},[bitmap])
    clearTimeout(watchdog);watchdog=window.setTimeout(()=>{if(scene.live)trackingError()},12000)
  }catch{busy=false;if(scene.live)trackingError()}
}
let statsAt=0
function frame(now:number){
  if(disposed)return
  const dt=lastTimestamp?Math.min(.06,(now-lastTimestamp)/1000):1/60;lastTimestamp=now
  if(!document.hidden){
    void captureFrame(now);scene.update(dt,now);scene.render()
    if(now-statsAt>250){
      statsAt=now;$('#snow-count').textContent=String(scene.world.particles.length);$('#snow-resting').textContent=String(scene.settled)
      if(scene.live){
        $('#snow-tracking-info').textContent=`검지 ${scene.tips.length} / 2 · ${scene.human.hasPerson?'몸 인식 중':'몸을 화면에 보여주세요'} · ${scene.mouth?.open?'입 벌림 감지':scene.mouth?'얼굴 인식 중':'얼굴 대기'}`
        $('#snow-hint-text').textContent=scene.snowing?'입을 벌려 입김을 불고, 검지로 그림을 그려보세요.':'검지를 구름 가까이 가져가보세요.'
      }
    }
  }
  animation=requestAnimationFrame(frame)
}
animation=requestAnimationFrame(frame)
scene.onCloud=()=>{if(scene.live)toast('눈이 내려요. 가만히 어깨 위에 쌓아보세요.')}
start.addEventListener('click',()=>void startCamera());$('#demo-start-camera').addEventListener('click',()=>void startCamera())
$('#snow-demo').addEventListener('click',()=>{
  if(starting)return
  stopCamera();scene.clear();scene.demo=true;scene.demoBody();showExperience(true);status('WINTER PLAYGROUND',true);$('#snow-caption-copy').textContent='마우스와 터치로 만나는 겨울';$('#snow-hint-text').textContent='구름을 클릭하고, 입김을 불어 그림을 그려보세요.';$('#snow-tracking-info').textContent='체험용 윤곽 · 실제 카메라 인식 아님'
})
stop.addEventListener('click',()=>{stopCamera();scene.clear();scene.demo=false;$('#snow-intro').hidden=false;$('#snow-live-hint').hidden=true;$('#snow-demo-tools').hidden=true;$('#snow-steps').hidden=false;$('#cloud-hint').hidden=false;document.body.classList.remove('snow-experiencing');status('CAMERA OFF');$('#snow-tracking-info').textContent='카메라를 켜면 나의 겨울이 시작돼요'})
$('#snow-reset').addEventListener('click',()=>{scene.clear();toast('눈과 입김을 말끔하게 정리했어요.')})
$('#snow-contour').addEventListener('click',()=>{scene.showContour=!scene.showContour;$('#snow-contour').setAttribute('aria-pressed',String(scene.showContour))})
const density=$<HTMLInputElement>('#snow-density'),wind=$<HTMLInputElement>('#snow-wind')
density.addEventListener('input',()=>{scene.density=Number(density.value)/100;$('#snow-density-value').textContent=`${density.value}%`})
wind.addEventListener('input',()=>{scene.world.wind=Number(wind.value)/100;$('#snow-wind-value').textContent=Number(wind.value)===0?'고요하게':`${Number(wind.value)<0?'←':'→'} ${Math.abs(Number(wind.value))}%`})
function position(event:PointerEvent):Vec{return{x:event.clientX/innerWidth*scene.worldWidth,y:event.clientY/innerHeight*900}}
canvas.addEventListener('pointerdown',event=>{if(!scene.demo)return;canvas.setPointerCapture(event.pointerId);scene.setPointer(position(event));scene.poke(position(event))})
canvas.addEventListener('pointermove',event=>{if(scene.demo&&canvas.hasPointerCapture(event.pointerId))scene.setPointer(position(event))})
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>scene.setPointer(null))
const breathe=$<HTMLButtonElement>('#demo-breathe')
breathe.addEventListener('pointerdown',event=>{if(!scene.demo)return;breathe.setPointerCapture(event.pointerId);scene.breathing=true;breathe.classList.add('breathing')})
for(const type of ['pointerup','pointercancel','lostpointercapture'])breathe.addEventListener(type,()=>{scene.breathing=false;breathe.classList.remove('breathing')})
breathe.addEventListener('keydown',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();scene.breathing=true;breathe.classList.add('breathing')}})
breathe.addEventListener('keyup',()=>{scene.breathing=false;breathe.classList.remove('breathing')})
addEventListener('blur',()=>{scene.breathing=false;scene.setPointer(null);breathe.classList.remove('breathing')})
addEventListener('resize',()=>{scene.resize();scene.world.wind=Number(wind.value)/100;smoothed.clear()})
const help=$<HTMLDialogElement>('#snow-help-dialog')
$('#snow-help').addEventListener('click',()=>help.showModal());$('#snow-close-help').addEventListener('click',()=>help.close());help.addEventListener('click',event=>{if(event.target===help)help.close()})
$('#snow-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('이 브라우저에서는 전체 화면을 지원하지 않아요.')}catch{toast('전체 화면으로 전환하지 못했어요.')}})
document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;scene.resetTracking();smoothed.clear();clearTimeout(watchdog);scene.breathing=false}else{lastVideoTime=-1;lastTimestamp=0}})
function dispose(){disposed=true;cancelAnimationFrame(animation);stopCamera();clearTimeout(toastTimer)}
addEventListener('pagehide',dispose,{once:true});addEventListener('pageshow',event=>{if(event.persisted)location.reload()})
if(import.meta.hot)import.meta.hot.dispose(dispose)
