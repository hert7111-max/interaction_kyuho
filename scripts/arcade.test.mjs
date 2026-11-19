import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ArcadeGame,isFingerGun,fingerCurl,JET_VARIANTS,JET_COLORS,MAX_JETS,MAX_BULLETS,MAX_DEBRIS} from '../src/arcade-game.ts'
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
