import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ClawGame, PIT_Y, EXIT } from './claw-game.ts'
import type { Phase, Toy } from './claw-game.ts'
import { createMachine } from './machine'
import { createToyModel } from './toys'
import type { ToyModel } from './toys'

const icons:Record<string,string>={
 arrow:'<path d="M12 19V5m-6 6 6-6 6 6"/>',sound:'<path d="m11 5-5 4H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',mute:'<path d="m11 5-5 4H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',refresh:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',cross:'<path d="m6 6 12 12M6 18 18 6"/>',check:'<path d="m5 12 5 5 9-10"/>',spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/>',claw:'<path d="M12 2v6m-5 2 5-3 5 3M7 10l-3 6 4 5m9-11 3 6-4 5m-4-12v10"/>',view:'<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10v9m-9-14 9 5 9-5"/>'}
const icon=(name:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]??''}</svg>`
const toyIcon=(kind:string,color='#e8b878')=>{
  const ears=kind==='bunny'?'<ellipse cx="22" cy="15" rx="5" ry="13"/><ellipse cx="42" cy="15" rx="5" ry="13"/>':kind==='kid'?'<path d="M13 30Q10 8 32 9q24 0 20 23Z" fill="#292524"/>':'<circle cx="16" cy="22" r="8"/><circle cx="48" cy="22" r="8"/>'
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="${color}" stroke="#493a34" stroke-width="1.7">${ears}<rect x="12" y="20" width="40" height="32" rx="15"/><circle cx="25" cy="35" r="2" fill="#352e2b"/><circle cx="39" cy="35" r="2" fill="#352e2b"/><path d="M28 43q4 4 8 0" fill="none"/>${kind==='kid'?'<path d="M20 28h9m6 0h9" stroke-width="3.6"/>':''}</g></svg>`
}
document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<header class="site-header">
  <a href="./" class="brand" aria-label="Toy Club 홈"><span class="brand-icon">${icon('claw')}</span>TOY CLUB<span class="brand-period">®</span></a>
  <div class="header-center"><span class="status-light"></span>THE LITTLE JOY ARCADE</div>
  <div class="header-actions"><button id="help" class="text-button">이용 방법 <span>↗</span></button><div class="header-divider"></div><button id="sound" class="icon-button" aria-label="소리 켜기" aria-pressed="false">${icon('mute')}</button></div>
</header>
<main class="arcade-layout">
  <section class="stage" aria-label="3D 인형뽑기 기계">
    <div class="stage-heading"><span class="small-label">THE CLAW ROOM</span><span class="edition-label">01 <i>/</i> CRAYON FRIENDS</span></div>
    <div class="camera-controls" role="group" aria-label="카메라 시점"><button data-view="angle" class="active" aria-pressed="true">${icon('view')}<span>입체</span></button><button data-view="front" aria-pressed="false">정면</button><button data-view="top" aria-pressed="false">위에서</button></div>
    <div id="canvas-host"><div class="loading" id="loading"><span class="loading-claw">${icon('claw')}</span><strong>작은 행복을 준비하고 있어요</strong><span>WELCOME TO THE CLUB</span></div></div>
    <div class="scene-note"><span class="note-star">✳</span><span>좋아하는 친구를<br>집으로 데려가세요.</span></div>
    <div class="stage-toast" id="toast" aria-live="polite"></div>
    <div class="stage-bottom"><span>${icon('view')} 드래그하여 둘러보기 <i>·</i> 스크롤로 확대</span><span class="freeplay"><i></i> FREE PLAY, ALWAYS.</span></div>
  </section>
  <aside class="control-panel">
    <div class="intro"><div class="small-label red">A LITTLE LUCK. A LOT OF JOY.</div><h1>오늘의 작은<br>행운을 잡아봐요<span>.</span></h1><p>한 번의 도전, 하나의 새로운 친구.<br>마음에 드는 인형 위로 집게를 움직여보세요.</p></div>
    <div class="machine-status"><span class="status-label"><i id="state-dot"></i><span id="state-label">집게를 움직여보세요</span></span><span id="phase-number">READY</span></div>
    <div class="phase-track" aria-label="집게 진행 상태"><span data-phase="descending"></span><span data-phase="gripping"></span><span data-phase="lifting"></span><span data-phase="transporting"></span><span data-phase="releasing"></span></div>
    <div class="controller-row">
      <div class="dpad" role="group" aria-label="집게 이동"><button data-direction="up" aria-label="뒤로 이동">${icon('arrow')}</button><button data-direction="left" aria-label="왼쪽으로 이동">${icon('arrow')}</button><span class="dpad-center">${icon('claw')}</span><button data-direction="right" aria-label="오른쪽으로 이동">${icon('arrow')}</button><button data-direction="down" aria-label="앞으로 이동">${icon('arrow')}</button></div>
      <div class="move-copy"><span class="small-label">01 — MOVE</span><strong>방향키로 위치 맞추기</strong><span>↑ 뒤 &nbsp; ↓ 앞 &nbsp; ← 좌 &nbsp; → 우</span><span class="move-tip">버튼을 길게 눌러도 움직여요</span></div>
    </div>
    <button id="drop" class="drop-button"><span>${icon('claw')}<strong>인형 잡기</strong></span><kbd>SPACE</kbd></button>
    <p class="control-note" id="control-note">한 번 누르면, 집게가 알아서 움직여요.</p>
    <div class="collection"><div class="section-row"><span class="small-label">MY LITTLE COLLECTION</span><span class="collection-counter"><b id="won-count">0</b><span>/ 15</span></span></div>
      <div class="collection-toys" id="collection-toys">${[['kid','#FFD9B3'],['bunny','#eda5b6'],['bear','#d1a372'],['dino','#8bbda6'],['dog','#f0e6d3']].map(([kind,color])=>`<div class="collection-slot" data-kind="${kind}" aria-label="${kind} 미획득">${toyIcon(kind!,color!)}<span class="slot-check">${icon('check')}</span></div>`).join('')}<span class="more-toys">+10</span></div>
      <p id="collection-note">첫 번째 친구가 기다리고 있어요.</p>
    </div>
    <div class="panel-bottom"><span><span class="small-label">ATTEMPTS</span><strong id="attempts">00</strong></span><button id="refill" class="reset-button">${icon('refresh')} 새로 채우기</button></div>
  </aside>
</main>
<footer class="site-footer"><span>Small things. <em>Big happiness.</em></span><span>MADE FOR YOUR INNER CHILD <span class="footer-star">✳</span></span><span>NO COINS. JUST GOOD TIMES.</span></footer>
<dialog id="help-dialog"><button class="dialog-close icon-button" aria-label="닫기">${icon('cross')}</button><span class="small-label red">HOW TO PLAY</span><h2>작은 행운을 잡는 법.</h2><ol><li><strong>위치를 맞춰요.</strong>방향키 또는 화면 버튼을 길게 눌러 인형 위로 이동하세요. ‘위에서’ 시점으로 보면 맞추기 쉬워요.</li><li><strong>스페이스를 눌러요.</strong>집게가 내려가고, 닫히고, 올라와 출구로 이동합니다. 이 동안에는 조작할 수 없어요.</li><li><strong>행운을 기다려요.</strong>인형의 중심을 잘 맞출수록 안정적으로 잡힙니다. 살짝 걸린 인형은 중간에 떨어질 수 있어요.</li><li><strong>출구를 확인해요.</strong>잡은 인형은 왼쪽 아래 출구로 나오고 컬렉션에 추가됩니다.</li></ol><p>모든 도전은 무료예요. 편하게 즐겨주세요.</p></dialog>`
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!
const game=new ClawGame(),host=$('#canvas-host'),dropButton=$<HTMLButtonElement>('#drop'),refill=$<HTMLButtonElement>('#refill')
const directionButtons=[...document.querySelectorAll<HTMLButtonElement>('[data-direction]')]
const arrows:Record<string,[number,number]>={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}
const directions:Record<string,string>={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}
const heldKeys=new Set<string>(),pointerKeys=new Map<number,string>()
let sound=false,audio:AudioContext|undefined,toastUntil=0,lastPhase:Phase|'loading'='loading',appReady=false,lastWon=0
const helpDialog=$<HTMLDialogElement>('#help-dialog')
$('#help').addEventListener('click',()=>{clearInput();helpDialog.showModal()})
$('.dialog-close').addEventListener('click',()=>helpDialog.close())
helpDialog.addEventListener('click',e=>{if(e.target===helpDialog)helpDialog.close()})
function playNote(frequency:number,duration=.13,delay=0){
  if(!sound)return
  audio??=new AudioContext();void audio.resume()
  const t=audio.currentTime+delay,osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.045,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain).connect(audio.destination);osc.start(t);osc.stop(t+duration+.02)
}
$('#sound').addEventListener('click',()=>{sound=!sound;$('#sound').innerHTML=icon(sound?'sound':'mute');$('#sound').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');$('#sound').setAttribute('aria-pressed',String(sound));playNote(660)})
function toast(text:string,kind='normal'){const el=$('#toast');el.textContent=text;el.dataset.kind=kind;el.classList.add('visible');toastUntil=performance.now()+3500}
function clearInput(){heldKeys.clear();pointerKeys.clear();directionButtons.forEach(b=>b.classList.remove('pressed'))}
function drop(){if(!appReady||helpDialog.open)return;if(game.drop()){clearInput();syncUI()}}
dropButton.addEventListener('click',drop)
addEventListener('keydown',e=>{
  if(helpDialog.open||!appReady||e.altKey||e.ctrlKey||e.metaKey)return
  if(e.key in arrows){e.preventDefault();if(!game.locked)heldKeys.add(e.key)}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)drop()}
})
addEventListener('keyup',e=>{heldKeys.delete(e.key)})
addEventListener('blur',clearInput)
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()})
for(const button of directionButtons){
  button.addEventListener('pointerdown',e=>{if(game.locked||!appReady)return;e.preventDefault();const key=directions[button.dataset.direction!]!;button.setPointerCapture(e.pointerId);pointerKeys.set(e.pointerId,key);button.classList.add('pressed')})
  const stop=(e:PointerEvent)=>{pointerKeys.delete(e.pointerId);button.classList.remove('pressed')}
  button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop)
}
const phaseText:Record<Phase,string>={ready:'집게를 움직여보세요',descending:'인형에게 다가가는 중',gripping:'조심조심, 꼭 잡아요',lifting:'천천히 들어 올리는 중',transporting:'출구로 이동하는 중',releasing:'새로운 친구를 만날 시간',returning:'다음 행운을 준비하는 중'}
const phaseNames:Phase[]=['descending','gripping','lifting','transporting','releasing']
function syncUI(){
  if(lastPhase!==game.phase){
    lastPhase=game.phase
    $('#state-label').textContent=game.won===game.toys.length?'모든 친구를 데려왔어요!':phaseText[game.phase]
    $('#phase-number').textContent=game.locked?'AUTO PLAY':'READY'
    $('#state-dot').classList.toggle('busy',game.locked)
    const phaseIndex=phaseNames.indexOf(game.phase)
    document.querySelectorAll<HTMLElement>('[data-phase]').forEach((el,i)=>{el.classList.toggle('done',game.phase==='returning'||(phaseIndex>=0&&i<phaseIndex));el.classList.toggle('current',i===phaseIndex)})
    dropButton.disabled=game.locked||game.won===game.toys.length;refill.disabled=game.locked;directionButtons.forEach(b=>b.disabled=game.locked)
    dropButton.querySelector('strong')!.textContent=game.locked?'행운을 기다리는 중…':game.won===game.toys.length?'모두 잡았어요!':'인형 잡기'
    $('#control-note').textContent=game.locked?'자동 진행 중에는 방향키와 스페이스가 잠겨요.':'한 번 누르면, 집게가 알아서 움직여요.'
  }
  $('#attempts').textContent=String(game.attempts).padStart(2,'0')
  $('#won-count').textContent=String(game.won)
  if(lastWon!==game.won){
    lastWon=game.won
    const kinds=new Set(game.toys.filter(t=>t.mode==='won').map(t=>t.kind))
    document.querySelectorAll<HTMLElement>('[data-kind]').forEach(el=>{el.classList.toggle('collected',kinds.has(el.dataset.kind as Toy['kind']));el.setAttribute('aria-label',`${el.dataset.kind} ${kinds.has(el.dataset.kind as Toy['kind'])?'획득':'미획득'}`)})
    $('#collection-note').textContent=game.lastPrize?`${game.lastPrize.name}, 우리 집에 온 걸 환영해!`:'첫 번째 친구가 기다리고 있어요.'
  }
}
game.onEvent=(event,toy)=>{
  if(event==='drop')playNote(330,.16)
  if(event==='grip')playNote(460,.09)
  if(event==='slip'){toast('아슬아슬… 인형이 빠져버렸어요.');playNote(230,.25)}
  if(event==='win'){toast(`${toy!.name} 획득! 출구를 확인해보세요.`, 'success');[523,659,784,1046].forEach((n,i)=>playNote(n,.25,i*.12))}
  if(event==='ready'&&game.lastResult==='miss')toast('조금만 더 가운데로! 다시 도전해볼까요?')
  if(event==='ready'&&game.won===game.toys.length)toast('15명의 친구가 모두 모였어요. 완벽한 컬렉션!', 'success')
}

async function boot(){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-label','유리 캐비닛 안의 여러 인형과 움직이는 금속 집게. 방향키로 이동하고 스페이스로 인형을 잡으세요.');renderer.domElement.setAttribute('role','img');host.append(renderer.domElement)
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eee7dc');scene.fog=new THREE.Fog('#eee7dc',25,60)
  const camera=new THREE.PerspectiveCamera(34,1,.1,80);camera.position.set(10.2,8.2,14.3)
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,3.83,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.enablePan=false;controls.minDistance=10.5;controls.maxDistance=24;controls.minPolarAngle=.3;controls.maxPolarAngle=1.48;controls.minAzimuthAngle=-Math.PI*.43;controls.maxAzimuthAngle=Math.PI*.43;controls.update()
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04)
  scene.environment=environment.texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose()
  const hemi=new THREE.HemisphereLight('#fff4e4','#a1907a',2.4);scene.add(hemi)
  const key=new THREE.DirectionalLight('#fff6e9',4.1);key.position.set(-5,12,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-8,right:8,top:10,bottom:-7,near:.5,far:30});key.shadow.normalBias=.035;key.shadow.bias=-.00015;key.shadow.radius=4;scene.add(key)
  const fill=new THREE.DirectionalLight('#e3edff',1.8);fill.position.set(7,7,-4);scene.add(fill)
  const inside=new THREE.PointLight('#fff6dc',14,8,2);inside.position.set(0,6.65,.4);scene.add(inside)
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#eee7dc',roughness:.94}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor)
  // Subtle floor medallion grounds the cabinet in a photographic studio scene.
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(4.40,4.45,.085,96),new THREE.MeshStandardMaterial({color:'#e6ddce',roughness:.78}));platform.position.y=.045;platform.receiveShadow=true;scene.add(platform)
  const machine=createMachine();scene.add(machine.group)
  const toyModels=new Map<number,ToyModel>()
  for(const toy of game.toys){const model=createToyModel(toy);toyModels.set(toy.id,model);scene.add(model)}
  const confettiGeometry=new THREE.PlaneGeometry(.06,.13),confettiMaterials=['#d76167','#e7b953','#83a18b','#bba2c7'].map(color=>new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}))
  const confetti:{mesh:THREE.Mesh;vx:number;vy:number;vz:number;life:number}[]=[]
  const eventHandler=game.onEvent
  game.onEvent=(event,toy)=>{
    eventHandler?.(event,toy)
    if(event==='win')for(let i=0;i<36;i++){
      const mesh=new THREE.Mesh(confettiGeometry,confettiMaterials[i%4]);mesh.position.set(EXIT.x,.9,2.85);scene.add(mesh);confetti.push({mesh,vx:(Math.random()-.5)*3,vy:3+Math.random()*3,vz:(Math.random()-.3)*2,life:2.6})
    }
  }
  refill.addEventListener('click',()=>{if(game.reset()){clearInput();lastPhase='loading';lastWon=-1;syncUI();toast('새로운 친구들로 가득 채웠어요.')}})
  const views:Record<string,THREE.Vector3>={angle:new THREE.Vector3(10.2,8.2,14.3),front:new THREE.Vector3(0,6.0,17.3),top:new THREE.Vector3(0,15.9,8.5)}
  let viewStart=new THREE.Vector3(),viewEnd=new THREE.Vector3(),viewTime=2
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    viewStart.copy(camera.position);viewEnd.copy(views[button.dataset.view!]!);viewTime=0
    document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))})
  }))
  controls.addEventListener('start',()=>{viewTime=2;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')})})
  function resize(){
    const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height
    camera.fov=width/height<.9?42:34;camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(host);resize()
  let previous=0
  function animate(time:number){
    const dt=Math.min((time-previous)/1000||0,1/25);previous=time
    if(!document.hidden){
      let dx=0,dz=0
      const keys=new Set([...heldKeys,...pointerKeys.values()]);for(const key of keys){const vector=arrows[key];if(vector){dx+=vector[0];dz+=vector[1]}}
      if(!helpDialog.open)game.move(dx,dz,dt)
      game.update(dt)
      machine.claw.position.set(game.x,game.y,game.z)
      machine.claw.rotation.y=Math.sin(game.time*1.5)*.015
      machine.fingers.forEach(f=>{f.rotation.z=THREE.MathUtils.lerp(.035,.58,game.opening)})
      const cableLength=Math.max(.02,6.82-game.y-.25);machine.cable.position.set(game.x,game.y+.25+cableLength/2,game.z);machine.cable.scale.y=cableLength
      machine.bridge.position.z=game.z;machine.trolley.position.set(game.x,6.89,game.z)
      machine.target.position.set(game.x,PIT_Y+.013,game.z);machine.target.visible=!game.locked
      machine.joystick.rotation.z=game.locked?0:-dx*.18;machine.joystick.rotation.x=game.locked?0:dz*.18
      machine.button.position.y=game.locked?2.96:2.99;machine.prizeLight.intensity=game.lastPrize?3.2+Math.sin(game.time*3)*.3:0
      for(const toy of game.toys){
        const model=toyModels.get(toy.id)!
        model.visible=toy.mode!=='won'||game.lastPrize?.id===toy.id
        model.position.set(toy.x,toy.y,toy.z);model.rotation.set(toy.tiltX,toy.yaw,toy.tiltZ)
        if(model.userData.openMouth&&model.userData.closedMouth){const excited=toy.mode==='held'||toy.mode==='falling'||toy.mode==='chute'||toy.mode==='won';model.userData.openMouth.visible=excited;model.userData.closedMouth.visible=!excited}
      }
      for(let i=confetti.length-1;i>=0;i--){const p=confetti[i]!;p.life-=dt;p.vy-=7*dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.mesh.rotation.x+=dt*4;p.mesh.rotation.z+=dt*3;if(p.life<=0||p.mesh.position.y<.05){scene.remove(p.mesh);confetti.splice(i,1)}}
      if(viewTime<1){viewTime=Math.min(1,viewTime+dt*1.8);camera.position.lerpVectors(viewStart,viewEnd,viewTime*viewTime*(3-2*viewTime))}
      controls.update();machine.canopy.visible=(camera.position.y-controls.target.y)<Math.hypot(camera.position.x,camera.position.z)*1.12;renderer.render(scene,camera);syncUI()
      directionButtons.forEach(b=>b.classList.toggle('pressed',keys.has(directions[b.dataset.direction!]!)))
      if(time>toastUntil)$('#toast').classList.remove('visible')
    }
    requestAnimationFrame(animate)
  }
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();clearInput();appReady=false;dropButton.disabled=true;toast('3D 화면 연결이 끊겼어요. 페이지를 새로고침해주세요.')})
  await renderer.compileAsync(scene,camera)
  $('#loading').remove();appReady=true;syncUI();requestAnimationFrame(animate)
}
boot().catch(error=>{
  console.error('Unable to initialize the 3D claw machine:',error)
  const loading=$('#loading');loading.innerHTML=`${icon('claw')}<strong>3D 화면을 열 수 없어요</strong><span>WebGL을 지원하는 최신 브라우저에서 다시 열어주세요.</span><button id="retry">다시 시도</button>`
  $('#retry').addEventListener('click',()=>location.reload());dropButton.disabled=true;refill.disabled=true;directionButtons.forEach(b=>b.disabled=true)
})
