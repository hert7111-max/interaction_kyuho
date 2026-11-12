import './colatec.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { createDancer,animateDancer } from './dancers'
import type { Dancer } from './dancers'
import { createDancehall } from './dancehall'
import { PartyConnection } from './party-network'
import { PartyMusic } from './party-music'
import type { Action,Player } from './party-types'
import { randomAvatar } from '../shared/world.mjs'
const paths:Record<string,string>={
 dance:'<path d="m8 4 3 3 5-2m-5 2-2 5 5 3 3 5m-8-8-4 5m9-12 4 5 3-2"/><circle cx="14" cy="3" r="2"/>',
 stop:'<path d="M7 3v9M11 2v10M15 4v8M19 7v7c0 5-3 8-7 8-3 0-5-2-7-5l-3-5a2 2 0 0 1 3-2l2 2"/>',
 lie:'<path d="M2 17h20M5 15l4-4 5 3 6-1m-10-2 3-4 5 2"/><circle cx="5" cy="9" r="2.3"/>',
 wave:'<path d="m8 12-3-6m6 4L9 3m5 7-1-8m4 9 1-6m-1 8 3-2c2 0 2 2 1 4-2 5-4 7-8 7-3 0-5-2-7-6l-2-4c0-2 2-3 3-1l2 3"/>',
 sound:'<path d="m10 5-5 4H2v6h3l5 4V5Z"/><path d="M14 8a6 6 0 0 1 0 8m4-12a11 11 0 0 1 0 16"/>',mute:'<path d="m10 5-5 4H2v6h3l5 4V5Z"/><path d="m15 9 6 6m0-6-6 6"/>',
 people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 5c3 1 3 4 3 6"/>',share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13H3v8h18v-8h-2"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',target:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 0-1 1-1 2m0 3h.01"/>',spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>'}
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??''}</svg>`
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<main class="party-app">
  <div id="scene" aria-label="형형색색의 미러볼과 조명으로 빛나는 3D 콜라텍"></div><div id="nameplates" aria-hidden="true"></div>
  <div class="scene-vignette"></div>
  <header class="topbar"><a class="brand" href="./" aria-label="콜라텍 홈"><span class="brand-spark">✳</span><span><b>콜라텍</b><small>우리 동네 온라인 댄스홀</small></span><span class="brand-dot">●</span></a><div class="motto"><i></i>오늘 밤도, 청춘.<i></i></div><div class="header-tools"><span class="online-badge">${icon('people')}<strong id="online-count">0</strong><span>명 접속</span></span><button id="invite" class="invite-button">${icon('share')}<span>친구 초대</span></button><button id="music" class="round-button" aria-label="음악 켜기" aria-pressed="false">${icon('mute')}</button></div></header>
  <div class="room-caption"><span class="live-pill"><i id="connection-dot"></i><span id="connection-label">LOCAL PARTY</span></span><span>01 <i>/</i> 청춘홀</span><small>RETRO DISCO · 128 BPM</small></div>
  <div class="welcome-wrap" id="welcome-wrap"><section class="welcome-card" aria-labelledby="welcome-title"><span class="eyebrow lime">WELCOME TO THE PARTY</span><h1 id="welcome-title">반짝이는 오늘,<br>같이 <em>춤출까요?</em></h1><p class="welcome-copy">화려한 옷, 신나는 리듬, 그리고 우리.<br>닉네임 하나면 입장 준비 끝!</p><div class="outfit-teaser"><span class="outfit-dots"><i></i><i></i><i></i><i></i></span><span>오늘의 드레스 & 정장은 랜덤이에요 ${icon('spark')}</span></div><form id="entry-form"><label for="nickname">오늘의 댄스 네임 <span id="nickname-length">0 / 12</span></label><div class="nickname-field"><input id="nickname" name="nickname" autocomplete="off" maxlength="24" placeholder="예: 춤추는 복숭아" required aria-describedby="entry-error"/><span>✦</span></div><label class="music-option"><input id="entry-music" type="checkbox" checked/><span>신나는 음악과 함께 입장하기</span></label><button id="enter" class="enter-button" type="submit" disabled><span id="enter-label">댄스홀에 불을 켜는 중…</span>${icon('arrow')}</button><p id="entry-error" class="entry-error" role="alert"></p></form><div class="welcome-foot"><span class="tiny-dot"></span>같은 Wi-Fi의 친구들과 실시간으로 함께해요</div></section><div class="welcome-sticker"><span>나이는 잊고</span><strong>리듬을 타요!</strong><span>LET YOURSELF SHINE ✧</span></div></div>
  <div class="session-info" id="session-info" hidden><span class="me-color" id="me-color"></span><strong id="my-name"></strong><span class="me-tag">나</span><span class="session-separator"></span><span id="outfit-name"></span></div>
  <div class="notice" id="notice" role="status"></div>
  <div class="controls-hud" id="controls-hud" hidden>
    <div class="keyboard-guide"><div class="arrow-keys"><kbd>↑</kbd><span><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span></div><div><strong>방향키로 움직여요</strong><span>원하는 곳에서, 원하는 리듬으로.</span></div></div>
    <div class="joystick" id="joystick" role="group" aria-label="터치 이동 조이스틱"><div class="joystick-cross"></div><div class="joystick-knob" id="joystick-knob"></div><span>MOVE</span></div>
    <nav class="action-bar" aria-label="캐릭터 행동"><button data-action="dance" class="action-dance active" aria-pressed="true">${icon('dance')}<span>춤추기</span><kbd>1</kbd></button><button data-action="idle" class="action-idle" aria-pressed="false">${icon('stop')}<span>멈추기</span><kbd>2</kbd></button><button data-action="lie" class="action-lie" aria-pressed="false">${icon('lie')}<span>눕기</span><kbd>3</kbd></button><button data-action="wave" class="action-wave" aria-pressed="false">${icon('wave')}<span>인사하기</span><kbd>4</kbd></button></nav>
    <div class="view-controls"><button id="find-me" class="round-button" aria-label="내 캐릭터로 시점 이동">${icon('target')}</button><button id="help" class="round-button" aria-label="이용 방법">${icon('help')}</button><span>드래그로 둘러보기 · 스크롤로 확대</span></div>
  </div>
  <div class="bottom-ticker"><span>좋은 음악에, 좋은 사람들.</span><span>NO AGE LIMIT. ONLY GOOD VIBES. <i>✳</i></span><span>오늘은 우리가 주인공!</span></div>
</main>
<dialog id="invite-dialog"><button class="dialog-close round-button" aria-label="닫기">${icon('close')}</button><span class="eyebrow lime">BETTER TOGETHER</span><h2>친구도 같이 춤춰요.</h2><p>같은 Wi-Fi 또는 로컬 네트워크에 연결한 뒤,<br>아래 주소를 휴대폰이나 컴퓨터에서 열어주세요.</p><div class="share-field"><input id="share-url" readonly aria-label="입장 주소"/><button id="copy-link" aria-label="입장 주소 복사">${icon('copy')}</button></div><span id="copy-status" class="dialog-note">이 컴퓨터에서 서버가 켜져 있는 동안 입장할 수 있어요.</span></dialog>
<dialog id="help-dialog"><button class="dialog-close round-button" aria-label="닫기">${icon('close')}</button><span class="eyebrow lime">EVERYBODY DANCE</span><h2>이렇게 즐겨주세요.</h2><ul><li><b>이동</b> 방향키 / WASD 또는 터치 조이스틱</li><li><b>행동</b> 아래 버튼 또는 숫자 1 · 2 · 3 · 4</li><li><b>인사</b> 손을 흔든 후 이전 행동으로 돌아와요.</li><li><b>눕기</b> 이동하거나 다른 행동을 선택하면 일어나요.</li><li><b>시점</b> 화면 드래그 · 휠 확대 · 내 캐릭터 버튼</li></ul><p class="dialog-note">무대의 하우스 댄서는 배경 캐릭터예요.<br>접속 인원에는 실제 입장한 친구만 표시돼요.</p></dialog>`
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!
const connection=new PartyConnection(),music=new PartyMusic(),keys=new Set<string>()
let entered=false,ready=false,joining=false,showMusic=false,moveX=0,moveZ=0,joystickPointer:number|null=null,lastMoveSent=0,noticeTimer:ReturnType<typeof setTimeout>|undefined,lanUrl=location.origin
const nickname=$<HTMLInputElement>('#nickname'),enter=$<HTMLButtonElement>('#enter'),inviteDialog=$<HTMLDialogElement>('#invite-dialog'),helpDialog=$<HTMLDialogElement>('#help-dialog')
const actionButtons=[...document.querySelectorAll<HTMLButtonElement>('[data-action]')]
if(navigator.maxTouchPoints>0)document.body.classList.add('touch-device')
function notice(message:string){$('#notice').textContent=message;$('#notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('visible'),3200)}
function updateMusic(){showMusic=music.playing;$('#music').innerHTML=icon(showMusic?'sound':'mute');$('#music').setAttribute('aria-label',showMusic?'음악 끄기':'음악 켜기');$('#music').setAttribute('aria-pressed',String(showMusic))}
$('#music').addEventListener('click',async()=>{if(music.playing)music.stop();else await music.start();updateMusic()})
$('#invite').addEventListener('click',()=>{stopInput();$('#share-url').setAttribute('value',lanUrl);inviteDialog.showModal()})
$('#help').addEventListener('click',()=>{stopInput();helpDialog.showModal()})
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>{dialog.querySelector('button')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()})})
$('#copy-link').addEventListener('click',async()=>{
  const field=$<HTMLInputElement>('#share-url')
  try{if(navigator.clipboard)await navigator.clipboard.writeText(lanUrl);else{field.select();if(!document.execCommand('copy'))throw new Error('copy unavailable')}$('#copy-status').textContent='주소를 복사했어요. 친구에게 보내주세요!'}catch{field.focus();field.select();$('#copy-status').textContent='주소를 길게 누르거나 Ctrl/Cmd+C로 복사해주세요.'}
})
async function roomInfo(){try{const response=await fetch('/api/info');if(!response.ok)throw new Error();const info=await response.json();if(!entered)$('#online-count').textContent=String(info.players);if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&info.lan.length)lanUrl=info.lan[0];}catch{if(!entered)$('#entry-error').textContent='로컬 서버에 연결할 수 없어요. npm start로 실행해주세요.'}}
void roomInfo();const infoTimer=setInterval(()=>{if(!entered)void roomInfo()},5000)
nickname.addEventListener('input',()=>{const value=[...nickname.value].slice(0,12).join('');nickname.value=value;$('#nickname-length').textContent=`${[...value].length} / 12`;$('#entry-error').textContent=''})
$('#entry-form').addEventListener('submit',event=>{
  event.preventDefault();if(!ready||joining)return
  const name=nickname.value.trim();if(!name){$('#entry-error').textContent='닉네임을 입력해주세요.';nickname.focus();return}
  joining=true;enter.disabled=true;$('#enter-label').textContent='친구들을 만나러 가는 중…';$('#entry-error').textContent=''
  connection.close();connection.session='';connection.id='';connection.retry=0
  if($<HTMLInputElement>('#entry-music').checked)void music.start().then(updateMusic)
  connection.join(name)
})
function stopInput(){keys.clear();moveX=moveZ=0;joystickPointer=null;$('#joystick-knob').style.transform='translate(-50%, -50%)';connection.move(0,0)}
const movementKeys:Record<string,[number,number]>={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}
addEventListener('keydown',e=>{
  if(!entered||!connection.connected||inviteDialog.open||helpDialog.open||e.metaKey||e.ctrlKey||e.altKey)return
  if(e.target instanceof HTMLInputElement)return
  const key=e.key.length===1?e.key.toLowerCase():e.key
  if(movementKeys[key]){e.preventDefault();keys.add(key)}
  const action=({'1':'dance','2':'idle','3':'lie','4':'wave'} as Record<string,Action>)[key]
  if(action&&!e.repeat){e.preventDefault();chooseAction(action)}
})
addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key))
addEventListener('blur',stopInput)
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopInput()})
addEventListener('pagehide',()=>{stopInput();connection.close();music.stop()})
function chooseAction(action:Action){if(!connection.connected)return;stopInput();connection.action(action)}
actionButtons.forEach(button=>button.addEventListener('click',()=>chooseAction(button.dataset.action as Action)))
const joystick=$('#joystick')
function stick(e:PointerEvent){const rect=joystick.getBoundingClientRect(),dx=e.clientX-rect.left-rect.width/2,dz=e.clientY-rect.top-rect.height/2,max=rect.width*.31,length=Math.hypot(dx,dz),ratio=length>max?max/length:1;moveX=dx*ratio/max;moveZ=dz*ratio/max;if(length<8)moveX=moveZ=0;$('#joystick-knob').style.transform=`translate(calc(-50% + ${dx*ratio}px),calc(-50% + ${dz*ratio}px))`}
joystick.addEventListener('pointerdown',e=>{if(!connection.connected)return;e.preventDefault();joystickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);stick(e)})
joystick.addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer)stick(e)})
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,()=>{moveX=moveZ=0;joystickPointer=null;$('#joystick-knob').style.transform='translate(-50%,-50%)';connection.move(0,0)})

async function boot(){
  const host=$('#scene'),touch=navigator.maxTouchPoints>0
  const renderer=new THREE.WebGLRenderer({antialias:!touch,alpha:false,powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(devicePixelRatio,touch?1.3:1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.outputColorSpace=THREE.SRGBColorSpace
  host.append(renderer.domElement)
  renderer.domElement.setAttribute('aria-label','컬러 조명 아래 함께 춤추는 3D 캐릭터들')
  const scene=new THREE.Scene();scene.background=new THREE.Color('#160b27');scene.fog=new THREE.FogExp2('#160b27',.017)
  const camera=new THREE.PerspectiveCamera(46,1,.1,80);camera.position.set(11,11.5,18)
  const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,1.5,-1.8);orbit.enableDamping=true;orbit.dampingFactor=.07;orbit.enablePan=false;orbit.minDistance=10;orbit.maxDistance=29;orbit.minPolarAngle=.40;orbit.maxPolarAngle=1.28;orbit.minAzimuthAngle=-1.10;orbit.maxAzimuthAngle=1.10;orbit.update()
  let follow=false,findTween=1
  orbit.addEventListener('start',()=>{follow=false;findTween=1})
  $('#find-me').addEventListener('click',()=>{follow=true;findTween=0})
  scene.add(new THREE.HemisphereLight('#ffd6f6','#9e68ba',2.2))
  const key=new THREE.DirectionalLight('#ffe8d6',3.1);key.position.set(2,10,8);key.castShadow=true;key.shadow.mapSize.set(touch?1024:2048,touch?1024:2048);Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.5,far:35});key.shadow.bias=-.0003;key.shadow.normalBias=.035;scene.add(key)
  const fill=new THREE.DirectionalLight('#7bbaff',1.8);fill.position.set(-8,6,-4);scene.add(fill)
  const pink=new THREE.PointLight('#ff24c9',65,22,2);pink.position.set(-7,5,-3);scene.add(pink)
  const cyan=new THREE.PointLight('#14e9ff',65,22,2);cyan.position.set(7,5,1);scene.add(cyan)
  const pmrem=new THREE.PMREMGenerator(renderer),environmentRoom=new RoomEnvironment(),env=pmrem.fromScene(environmentRoom,.04);scene.environment=env.texture;scene.environmentIntensity=.55;environmentRoom.dispose();pmrem.dispose()
  const hall=createDancehall(scene)
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.5,.5,1.0);composer.addPass(bloom);composer.addPass(new OutputPass())
  const crew:{model:Dancer;phase:number}[]=[]
  let crewSeed=100;const seeded=()=>{crewSeed=(crewSeed*1664525+1013904223)>>>0;return crewSeed/4294967296}
  for(const [i,x]of [-4.6,-2.8,2.8,4.6].entries()){const avatar=randomAvatar(seeded);avatar.outfit=i%2?'suit':'dress';const model=createDancer(avatar);model.root.position.set(x,.39,-6.8);scene.add(model.root);crew.push({model,phase:i*.4})}
  const dj=createDancer(randomAvatar(seeded));dj.root.position.set(0,.4,-7.8);scene.add(dj.root);crew.push({model:dj,phase:2})
  const actors=new Map<string,{player:Player;model:Dancer;label:HTMLDivElement}>()
  function addPlayer(player:Player){
    if(actors.has(player.id))return
    const isMe=player.id===connection.id,model=createDancer(player.avatar,isMe);model.root.position.set(player.x,0,player.z);model.root.rotation.y=player.yaw;scene.add(model.root)
    const label=document.createElement('div');label.className='nameplate'+(isMe?' self':'');label.style.setProperty('--player-color',player.avatar.color)
    const name=document.createElement('span');name.textContent=player.nickname;label.append(name)
    if(isMe){const badge=document.createElement('b');badge.textContent='나';label.append(badge)}
    $('#nameplates').append(label);actors.set(player.id,{player:{...player},model,label})
  }
  function removePlayer(id:string){const actor=actors.get(id);if(!actor)return;scene.remove(actor.model.root);actor.label.remove();actors.delete(id)}
  function count(){if(connection.connected)$('#online-count').textContent=String(actors.size)}
  connection.onWelcome=players=>{
    for(const id of actors.keys())removePlayer(id)
    for(const player of players)addPlayer(player)
    const me=players.find(p=>p.id===connection.id)!
    joining=false;entered=true;$('#welcome-wrap').hidden=true;$('#controls-hud').hidden=false;$('#session-info').hidden=false;document.body.classList.add('entered');$('#my-name').textContent=me.nickname;$('#me-color').style.background=me.avatar.color;$('#outfit-name').textContent=me.avatar.outfit==='dress'?'오늘은 반짝 드레스':'오늘은 컬러풀 정장';clearInterval(infoTimer);music.now=()=>connection.now();follow=true;findTween=0;count();notice(`${me.nickname}님, 오늘 밤 주인공은 당신이에요!`)
  }
  connection.onJoined=player=>{if(!actors.has(player.id)){addPlayer(player);if(entered)notice(`${player.nickname}님이 댄스홀에 입장했어요.`)}count()}
  connection.onLeft=id=>{removePlayer(id);count()}
  connection.onState=players=>{
    for(const state of players){const actor=actors.get(state.id);if(!actor)continue;Object.assign(actor.player,state);if(state.id===connection.id)actionButtons.forEach(button=>{const active=button.dataset.action===state.action;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))})}
  }
  connection.onStatus=(status,message)=>{
    const live=status==='connected';$('#connection-dot').classList.toggle('offline',!live);$('#connection-label').textContent=live?'LIVE · 함께 춤추는 중':status==='error'?'연결 확인 필요':'댄스홀 연결 중…';actionButtons.forEach(b=>b.disabled=!live)
    if(!live){stopInput();$('#online-count').textContent='—'}
    if(status==='error'){joining=false;enter.disabled=false;$('#enter-label').textContent='입장하고 춤추기';$('#entry-error').textContent=message||'연결을 확인해주세요.';if(entered){entered=false;$('#welcome-wrap').hidden=false;$('#controls-hud').hidden=true;$('#session-info').hidden=true;document.body.classList.remove('entered')}}
    if(status==='reconnecting'&&entered)notice('연결이 잠시 끊겼어요. 같은 캐릭터로 다시 연결하고 있어요.')
    if(live)count()
  }
  const point=new THREE.Vector3(),followTarget=new THREE.Vector3(),delta=new THREE.Vector3()
  let previous=0
  function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.fov=w/h<.8?59:46;camera.updateProjectionMatrix()}
  new ResizeObserver(resize).observe(host);resize()
  function animate(ms:number){
    const dt=Math.min((ms-previous)/1000||0,.05);previous=ms
    if(!document.hidden){
      const time=connection.now()
      if(connection.connected&&entered&&!helpDialog.open&&!inviteDialog.open){let dx=moveX,dz=moveZ;for(const key of keys){const v=movementKeys[key];if(v){dx+=v[0];dz+=v[1]}}const length=Math.max(1,Math.hypot(dx,dz));if(ms-lastMoveSent>=50){connection.move(dx/length,dz/length);lastMoveSent=ms}}
      hall.update(time%10000)
      for(const dancer of crew)animateDancer(dancer.model,'dance',false,time+dancer.phase,dt)
      for(const {player,model,label}of actors.values()){
        const a=1-Math.exp(-dt*17);model.root.position.x+=(player.x-model.root.position.x)*a;model.root.position.z+=(player.z-model.root.position.z)*a
        const angle=Math.atan2(Math.sin(player.yaw-model.root.rotation.y),Math.cos(player.yaw-model.root.rotation.y));model.root.rotation.y+=angle*a
        animateDancer(model,player.action,player.moving,time,dt)
        point.set(model.root.position.x,player.action==='lie'?.9:2.45,model.root.position.z).project(camera)
        const visible=point.z>-1&&point.z<1&&Math.abs(point.x)<1.15&&Math.abs(point.y)<1.2;label.hidden=!visible
        if(visible){label.style.left=`${(point.x*.5+.5)*host.clientWidth}px`;label.style.top=`${(-point.y*.5+.5)*host.clientHeight}px`}
      }
      const me=actors.get(connection.id)
      if(follow&&me){
        followTarget.set(THREE.MathUtils.clamp(me.model.root.position.x*.55,-3.5,3.5),1.05,THREE.MathUtils.clamp(me.model.root.position.z*.45-1.8,-3.4,1))
        delta.copy(followTarget).sub(orbit.target).multiplyScalar(1-Math.exp(-dt*2.5));orbit.target.add(delta);camera.position.add(delta)
        if(findTween<1){findTween+=dt;camera.position.lerp(new THREE.Vector3(followTarget.x,11,followTarget.z+18),Math.min(1,dt*3))}
      }
      orbit.update();composer.render()
    }
    requestAnimationFrame(animate)
  }
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();stopInput();connection.close();notice('3D 화면 연결이 끊겼어요. 새로고침해서 다시 입장해주세요.')})
  await renderer.compileAsync(scene,camera)
  ready=true;enter.disabled=false;$('#enter-label').textContent='입장하고 춤추기';requestAnimationFrame(animate)
}
boot().catch(error=>{console.error(error);$('#entry-error').textContent='3D 화면을 열 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.';$('#enter-label').textContent='3D 화면 연결 확인 필요';enter.disabled=true})
