import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ArcadeGame,isFingerGun,fingerCurl,JET_VARIANTS,JET_COLORS,MAX_JETS,MAX_BULLETS,MAX_DEBRIS,MAX_ENEMY_BULLETS,faceTarget,bulletHitsFace} from '../src/arcade-game.ts'
function gun(){const h=Array.from({length:21},()=>({x:.5,y:.8,z:0}));h[5]={x:.5,y:.6,z:0};h[6]={x:.5,y:.45,z:0};h[7]={x:.5,y:.3,z:0};h[8]={x:.5,y:.2,z:0};h[2]={x:.4,y:.69,z:0};h[3]={x:.34,y:.59,z:0};h[4]={x:.26,y:.45,z:0};for(const [i,x] of [[9,.56],[13,.62],[17,.68]]){h[i]={x,y:.64,z:0};h[i+1]={x,y:.55,z:0};h[i+2]={x,y:.64,z:0};h[i+3]={x,y:.71,z:0}}return h}
const input=(id='Left',x=320)=>({id,tip:{x,y:440},direction:{x:0,y:-1},firing:true,curls:[0,1,1,1],thumb:{x:0,y:0},activity:1})
function advance(g,seconds,hands=[]){for(let i=0;i<Math.ceil(seconds*60);i++)g.update(1/60,hands)}
test('A finger gun needs an extended index/thumb and curled lower fingers; open palms and folded index do not fire',()=>{
  const h=gun();assert.equal(isFingerGun(h,4/3),true);assert.ok(fingerCurl(h,5,4/3)<.1);assert.ok(fingerCurl(h,9,4/3)>.9)
  for(const i of [9,13,17])h[i+3]={x:h[i].x,y:.3,z:0};assert.equal(isFingerGun(h,4/3),false)
  const folded=gun();folded[8]={x:.5,y:.7,z:0};assert.equal(isFingerGun(folded,4/3),false);assert.equal(isFingerGun([]),false)
  const thumb=gun();thumb[4]={...thumb[3]};assert.equal(isFingerGun(thumb,4/3),false)
})
test('Eight distinct jet variants and colors fly upward and remain bounded',()=>{
  const g=new ArcadeGame(()=>.4);g.jets.length=0
  for(let i=0;i<JET_VARIANTS;i++)g.spawn(400)
  assert.equal(new Set(g.jets.map(j=>j.variant)).size,8);assert.equal(new Set(JET_COLORS).size,8)
  const before=g.jets[0].y;advance(g,.25);assert.ok(g.jets[0].y<before)
  for(let i=0;i<50;i++)g.spawn();assert.ok(g.jets.length<=MAX_JETS)
})
test('Finger-gun pose gives twelve physical rounds per second and stops immediately without hands',()=>{
  const g=new ArcadeGame(()=>.5);g.jets.length=0;advance(g,1,[input()]);assert.ok(g.rounds>=12&&g.rounds<=13);assert.equal(g.firing,true)
  const rounds=g.rounds;advance(g,.4);assert.equal(g.rounds,rounds);assert.equal(g.firing,false)
})
test('Swept bullets hit once, score, explode with smoke, and jets fall under gravity',()=>{
  const g=new ArcadeGame(()=>.5);g.jets.length=0;g.spawn(320);const jet=g.jets[0];jet.x=320;jet.speed=0
  advance(g,.2,[input()]);assert.equal(jet.state,'falling');assert.equal(g.kills,1);assert.equal(g.score,100);assert.equal(g.hit(jet),false)
  assert.ok(g.debris.some(p=>p.kind==='spark'));assert.ok(g.debris.some(p=>p.kind==='smoke'))
  const speed=jet.vy;advance(g,.2);assert.ok(jet.vy>speed);advance(g,3);assert.ok(!g.jets.includes(jet)||jet.state==='flying')
})
test('Both hands can shoot separate jets; target assistance never hits behind the barrel',()=>{
  const g=new ArcadeGame(()=>.5);g.jets.length=0;g.spawn(320);g.jets[0].x=160;g.jets[0].speed=0;g.spawn(320);g.jets[1].x=480;g.jets[1].speed=0
  advance(g,.2,[input('Left',160),input('Right',480)]);assert.equal(g.kills,2)
  g.reset();g.jets.length=0;g.spawn(440);const jet=g.jets[0];jet.x=320;jet.speed=0;const away={...input(),tip:{x:320,y:200}};advance(g,.2,[away]);assert.equal(jet.state,'flying')
})
test('Pools, effects and rounds stay bounded over a long dual-hand session; reset retains arrays',()=>{
  const g=new ArcadeGame(()=>.47),jets=g.jets,bullets=g.bullets,debris=g.debris;advance(g,70,[input('Left',280),input('Right',360)])
  assert.ok(jets.length<=MAX_JETS);assert.ok(bullets.length<=MAX_BULLETS);assert.ok(debris.length<=MAX_DEBRIS)
  g.reset();assert.equal(g.jets,jets);assert.equal(g.bullets,bullets);assert.equal(g.debris,debris);assert.equal(g.score,0);assert.equal(g.rounds,0);assert.equal(g.jets.length,5)
})

function face(){return faceTarget(Array.from({length:24},(_,i)=>({x:320+70*Math.cos(i/24*Math.PI*2),y:250+90*Math.sin(i/24*Math.PI*2)})))}
const enemy=(x=320,y=250,vx=0,vy=0)=>({x,y,px:x,py:y,vx,vy,age:0,side:'enemy'})
test('Face target rejects cropped-out/invalid contours and swept shots use the contour rather than its rectangle',()=>{
 const f=face();assert.ok(f);assert.equal(faceTarget([]),null);assert.equal(faceTarget(f.outline.map(p=>({x:p.x+700,y:p.y}))),null)
 assert.equal(bulletHitsFace({...enemy(420,250),px:220},f),true)
 assert.equal(bulletHitsFace({...enemy(252,163),px:245,py:162},f),false)
 assert.equal(bulletHitsFace(enemy(),f),true)
})
test('Jets aim real enemy projectiles at the tracked face and stop targeting when it is outside',()=>{
 const g=new ArcadeGame(()=>.4),f=face();g.jets.length=0;g.spawn(80);g.jets[0].x=90;g.jets[0].shotClock=0;g.update(1/60,[],f,true)
 assert.equal(g.enemyBullets.length,1);const b=g.enemyBullets[0];assert.ok(b.vx>0&&b.vy>0);assert.ok(b.x>90)
 g.enemyBullets.length=0;g.jets[0].shotClock=0;g.update(1/60,[],null,true);assert.equal(g.enemyBullets.length,0)
})
test('Only enemy hits drain health, smoothly after contact, with bounded burst damage',()=>{
 const g=new ArcadeGame(()=>.4),f=face();g.jets.length=0;g.enemyBullets.push(enemy());g.update(1/60,[],f,true)
 assert.equal(g.hp,100);assert.equal(g.damageDebt,12);assert.equal(g.enemyBullets.length,0)
 g.update(1/60,[],f,true);assert.ok(g.hp<100&&g.hp>99)
 for(let i=0;i<40;i++)g.update(1/60,[],f,true);assert.ok(Math.abs(g.hp-88)<.001)
 for(let i=0;i<30;i++)g.enemyBullets.push(enemy());g.update(1/60,[],f,true);assert.equal(g.damageDebt,12)
 const health=g.hp;g.enemyBullets.push(enemy(30,30));g.update(1/60,[],f,true);assert.ok(g.hp>health-1)
})
test('Zero HP explodes once, stops guns, and only sustained off-screen face tracking can recharge and revive',()=>{
 const g=new ArcadeGame(()=>.4),f=face();g.jets.length=0;g.hp=.1;g.damageDebt=1;g.update(1/60,[input()],f,true)
 assert.equal(g.hp,0);assert.equal(g.dead,true);assert.equal(g.firing,false);assert.equal(g.rounds,0);const serial=g.explosionSerial;assert.ok(g.debris.length>=100)
 for(let i=0;i<120;i++)g.update(1/60,[input()],f,true);assert.equal(g.explosionSerial,serial);assert.equal(g.hp,0)
 for(let i=0;i<120;i++)g.update(1/60,[],null,false);assert.equal(g.hp,0)
 for(let i=0;i<30;i++)g.update(1/60,[],null,true);assert.equal(g.hp,0)
 g.update(1/60,[],f,true);for(let i=0;i<30;i++)g.update(1/60,[],null,true);assert.equal(g.hp,0)
 for(let i=0;i<320;i++)g.update(1/60,[],null,true);assert.equal(g.hp,100);assert.equal(g.dead,false)
 g.update(1/60,[input()],f,true);assert.ok(g.rounds>0)
})
test('Kills before the top increment combo exactly once, escaping jets reset it, and reset clears combat state',()=>{
 const g=new ArcadeGame(()=>.4);g.jets.length=0;g.spawn(200);assert.equal(g.hit(g.jets[0]),true);assert.equal(g.combo,1);g.hit(g.jets[0]);assert.equal(g.combo,1)
 g.spawn(100);g.hit(g.jets[1]);assert.equal(g.combo,2);assert.equal(g.bestCombo,2)
 g.spawn(-69);g.jets[2].speed=100;g.update(.06,[]);assert.equal(g.combo,0);assert.equal(g.bestCombo,2)
 g.spawn(-60);assert.equal(g.hit(g.jets.at(-1)),false)
 const bullets=g.enemyBullets;g.hp=20;g.damageDebt=30;g.enemyBullets.push(enemy());g.reset();assert.equal(g.hp,100);assert.equal(g.combo,0);assert.equal(g.bestCombo,0);assert.equal(g.damageDebt,0);assert.equal(g.enemyBullets,bullets);assert.equal(bullets.length,0)
})
test('Enemy bullets and face effects stay bounded through sustained face combat',()=>{
 const g=new ArcadeGame(()=>.4),f=face();for(let i=0;i<60*90;i++){g.hp=100;g.update(1/60,[],f,true);assert.ok(g.enemyBullets.length<=MAX_ENEMY_BULLETS);assert.ok(g.debris.length<=MAX_DEBRIS)}
})
test('Shared MediaPipe runtime emits matching face contours only on new face inference; skipped frames stay null',async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm'),sandbox={self:{},performance:{now:()=>0}}
 runInNewContext(await readFile(new URL('../public/papa-runtime.js',import.meta.url),'utf8'),sandbox)
 const runtime=new sandbox.self.PapaVisionRuntime();runtime.hands={detectForVideo:()=>({landmarks:[],handedness:[]})};runtime.loops=[[33,133],[362,263]]
 let present=true,calls=0;runtime.face={detectForVideo:()=>{calls++;return{faceLandmarks:present?[Array.from({length:468},(_,i)=>({x:i/468,y:i/468}))]:[]}}}
 const detected=runtime.detect({},1,true);assert.equal(detected.faceOutline.length,36);assert.equal(detected.eyes.length,2)
 const skipped=runtime.detect({},2,true);assert.equal(skipped.faceOutline,null);assert.equal(skipped.eyes,null);assert.equal(calls,1)
 present=false;const absent=runtime.detect({},3,true);assert.equal(absent.faceOutline.length,0);assert.equal(absent.eyes.length,0);assert.equal(calls,2)
})
