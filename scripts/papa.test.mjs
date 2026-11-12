import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PapaGame,chooseTarget,floorExtent,isPointing,RAINBOW,PERSON_VARIANTS} from '../src/papa-game.ts'
const advance=(game,seconds,aims=[])=>{for(let t=0;t<seconds;t+=1/60)game.update(1/60,aims)}
const aim=(x,y,dx=0,dy=-1)=>({id:'test',tip:{x,y},direction:{x:dx,y:dy},pointing:true})
function single(){const game=new PapaGame(1200,900,()=>.5);game.people=[];game.spawn(250);game.running=true;return game}
test('Climbers move upward and spawn with all twelve appearance variants',()=>{
  const game=single(),person=game.people[0],before=person.y;advance(game,.5);assert.ok(person.y<before)
  game.people=[];for(let i=0;i<PERSON_VARIANTS;i++)game.spawn(450)
  assert.equal(new Set(game.people.map(p=>p.variant)).size,PERSON_VARIANTS)
  assert.equal(RAINBOW.length,7)
})
test('Pointing ray selects its nearest eligible target and ignores a curled/non-pointing finger',()=>{
  const game=single(),one=game.people[0];one.x=600;one.y=350;game.spawn(150);game.people[1].x=600
  assert.equal(chooseTarget(aim(600,700),game.people),one)
  assert.equal(chooseTarget({...aim(600,700),pointing:false},game.people),null)
  assert.equal(chooseTarget(aim(50,700,-1,0),game.people),null)
  one.state='falling';assert.equal(chooseTarget(aim(600,700),game.people),game.people[1])
})
test('A laser hit shocks once, emits sparks and smoke, then falls under gravity',()=>{
  const game=single(),person=game.people[0];person.x=600
  game.update(1/60,[aim(600,700)])
  assert.equal(person.state,'shocked');assert.equal(game.hit(person),false)
  advance(game,.2,[aim(600,700)]);assert.equal(person.state,'shocked')
  assert.ok(game.particles.some(p=>p.kind==='smoke'));assert.ok(game.particles.some(p=>p.kind==='spark'))
  advance(game,.3);assert.equal(person.state,'falling');const vy=person.vy;advance(game,.1);assert.ok(person.vy>vy)
})
test('Floor impact happens once, emits pixel blood, and the actor and all effects expire',()=>{
  const game=single(),person=game.people[0];person.x=600;game.hit(person)
  let landed=false
  for(let i=0;i<240;i++){game.update(1/120,[]);if(person.state==='landed'){landed=true;break}}
  assert.ok(landed);assert.equal(game.impacts,1);assert.ok(Math.abs(person.y+floorExtent(person)-900)<.001)
  assert.ok(game.particles.some(p=>p.kind==='blood'));assert.equal(game.stains.length,1)
  const expiredId=person.id
  advance(game,3)
  assert.ok(!game.people.some(p=>p.id===expiredId));assert.equal(game.impacts,1)
  assert.equal(game.stains.length,0);assert.equal(game.particles.length,0)
})
test('Two fingers can hit two independent actors in the same update',()=>{
  const game=single();game.people[0].x=300;game.spawn(250);game.people[1].x=900
  game.update(1/60,[aim(300,700),{...aim(900,700),id:'other'}])
  assert.equal(game.beams.length,2);assert.equal(game.people.filter(p=>p.state==='shocked').length,2)
})
test('3D index joint geometry distinguishes extension and curling',()=>{
  const hand=Array.from({length:21},()=>({x:.5,y:.8,z:0}))
  hand[5]={x:.5,y:.6,z:0};hand[6]={x:.5,y:.45,z:0};hand[8]={x:.5,y:.2,z:0}
  assert.equal(isPointing(hand,16/9),true)
  hand[8]={x:.5,y:.65,z:0};assert.equal(isPointing(hand,16/9),false)
  assert.equal(isPointing([]),false)
})
test('No hand input stops beams immediately; long pauses and population remain bounded',()=>{
  const game=single();game.update(.01,[aim(600,700)]);assert.ok(game.beams.length)
  game.update(.01,[]);assert.equal(game.beams.length,0)
  advance(game,90);assert.ok(game.people.length<=30);assert.ok(game.particles.length<=850)
})

test('Adult cast has moderately increased population and speed, with bounded density',()=>{
  const game=new PapaGame(1600,900)
  assert.ok(game.people.length>=8&&game.people.length<=10)
  assert.ok(game.people.every(p=>p.speed>=30&&p.speed<=65))
  advance(game,30);assert.ok(game.people.length>=12&&game.people.length<=30)
  const portrait=new PapaGame(420,900);assert.equal(portrait.people.length,6)
})
test('Compaction retains active array identity and reset restores effects without accumulating objects',()=>{
  const game=new PapaGame(1200,900),persones=game.people,particles=game.particles,stains=game.stains
  const initial=new Set(persones);advance(game,8)
  assert.equal(game.people,persones);assert.equal(game.particles,particles);assert.equal(game.stains,stains)
  assert.ok(game.people.some(r=>initial.has(r)),'Expired objects are reused')
  for(let i=0;i<30;i++){game.reset();game.update(.02,[])}
  assert.ok(game.people.length<=30);assert.equal(game.particles.length,0);assert.equal(game.stains.length,0)
})
