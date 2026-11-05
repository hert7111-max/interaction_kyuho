import assert from 'node:assert/strict'
import * as THREE from 'three'
import { ClawGame, createToys, PIT_Y, TOP_Y, EXIT, LIMITS } from '../src/claw-game.ts'
import { createToyModel } from '../src/toys.ts'
import { createMachine } from '../src/machine.ts'

function sequence(values){let i=0;return()=>values[i++]??values.at(-1)}
function advance(game,seconds){for(let i=0;i<Math.ceil(seconds*120);i++)game.update(1/120)}
function runRound(game,inspect=()=>{}){
  const phases=[game.phase]
  for(let i=0;i<2000&&game.locked;i++){
    game.update(1/120)
    if(phases.at(-1)!==game.phase)phases.push(game.phase)
    inspect(game)
  }
  assert.equal(game.phase,'ready','A round must finish automatically')
  return phases
}
function aim(game,toy=game.toys[0]){game.x=toy.x;game.z=toy.z;return toy}
{
  const game=new ClawGame()
  game.move(1,0,1);assert.ok(game.x>0);assert.equal(game.z,-.1)
  game.move(0,-1,1);assert.ok(game.z<-.1)
  game.move(-1,1,100);assert.equal(game.x,-LIMITS.x);assert.equal(game.z,LIMITS.z)
  game.move(1,-1,100);assert.equal(game.x,LIMITS.x);assert.equal(game.z,-LIMITS.z)
  const straight=new ClawGame(),diagonal=new ClawGame();straight.move(1,0,.2);diagonal.move(1,1,.2)
  assert.ok(Math.abs(straight.x-Math.hypot(diagonal.x,diagonal.z+.1))<1e-8)
  console.log('✓ Four-direction movement, diagonal speed and rail boundaries')
}
{
  const game=new ClawGame(()=>.05),toy=aim(game),events=[]
  game.onEvent=(event)=>events.push(event)
  assert.equal(game.drop(),true);assert.equal(game.attempts,1)
  let sawHeld=false,sawOutput=false
  const phases=runRound(game,g=>{
    if(g.locked){
      const position=[g.x,g.y,g.z],attempts=g.attempts,phase=g.phase
      g.move(1,1,10);assert.deepEqual([g.x,g.y,g.z],position)
      assert.equal(g.drop(),false);assert.equal(g.reset(),false);assert.equal(g.attempts,attempts);assert.equal(g.phase,phase)
    }
    if(g.phase==='transporting'){assert.equal(g.y,TOP_Y);assert.ok(g.held,'Stable prize is carried toward the chute')}
    if(g.held){sawHeld=true;assert.ok(g.held.y<g.y);assert.ok(Math.abs(g.held.x-g.x)<.05)}
    if(toy.mode==='chute'){sawOutput=true;assert.ok(toy.y<=PIT_Y)}
  })
  assert.deepEqual(phases,['descending','gripping','lifting','transporting','releasing','returning','ready'])
  assert.ok(sawHeld&&sawOutput);assert.equal(game.won,1);assert.equal(toy.mode,'won');assert.equal(toy.x,EXIT.x);assert.ok(toy.z>2.5);assert.equal(toy.y,.84)
  assert.equal(game.lastPrize,toy);assert.equal(game.lastResult,'won');assert.equal(game.held,null);assert.equal(game.opening,1);assert.equal(game.y,TOP_Y)
  assert.deepEqual(events,['drop','grip','win','ready'])
  advance(game,5);assert.equal(game.won,1,'A prize cannot be counted twice')
  assert.ok(game.reset());assert.equal(game.won,0);assert.equal(game.attempts,0);assert.equal(game.toys.length,15);assert.equal(game.lastPrize,null)
  console.log('✓ Full automatic cycle, input lock in every phase, stable grip, visible chute delivery, one-time scoring and reset')
}
for(const [name,random]of [['lifting',sequence([0,.99,0,.4])],['transporting',sequence([0,.99,.99,.2])]]){
  const game=new ClawGame(random),toy=aim(game);const events=[];game.onEvent=e=>events.push(e)
  game.drop();let seenFalling=false;runRound(game,g=>{if(toy.mode==='falling')seenFalling=true;if(g.phase==='releasing')assert.equal(g.held,null)})
  assert.ok(seenFalling);assert.ok(events.includes('slip'));assert.equal(game.won,0);assert.equal(toy.mode,'floor');assert.equal(toy.y,PIT_Y);assert.equal(game.lastResult,'slipped')
  console.log(`✓ Unstable grip can slip during ${name}, fall with gravity and settle back in the machine`)
}
{
  const game=new ClawGame(()=>1);aim(game);game.drop();runRound(game)
  assert.equal(game.won,0);assert.equal(game.lastResult,'miss');assert.equal(game.held,null)
  game.x=EXIT.x;game.z=EXIT.z;game.drop();assert.equal(game.candidate,null);runRound(game);assert.equal(game.won,0)
  console.log('✓ Missed grabs and empty-space attempts still complete without awarding prizes')
}
{
  const center=new ClawGame(sequence([.1,.65,0,.5]));aim(center);center.drop();advance(center,2.8);assert.equal(center.stable,true)
  const edge=new ClawGame(sequence([.1,.65,0,.5]));aim(edge);edge.x+=.5;edge.drop();advance(edge,2.8);assert.equal(edge.stable,false)
  console.log('✓ Alignment changes grip stability for the same random outcome')
}
{
  const game=new ClawGame(()=>.01)
  for(let i=0;i<15;i++){aim(game,game.toys[i]);game.drop();runRound(game);assert.equal(game.won,i+1)}
  const position=[game.x,game.z];game.move(1,1,1);assert.deepEqual([game.x,game.z],position);assert.equal(game.drop(),false)
  assert.ok(game.reset());assert.ok(game.toys.every(t=>t.mode==='floor'));assert.equal(game.drop(),true)
  console.log('✓ All 15 distinct toys are collectible; completed collection can be refilled')
}
{
  const toys=createToys();assert.equal(new Set(toys.map(t=>t.kind)).size,6);assert.ok(new Set(toys.map(t=>t.color)).size>=12)
  let outlineCount=0
  for(const toy of toys){
    const model=createToyModel(toy);model.updateMatrixWorld(true)
    const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3())
    assert.ok(size.x>0&&size.y>.65&&size.y<1.5&&size.z>0)
    assert.ok(box.min.y>-.15&&box.min.y<.05)
    model.traverse(object=>{if(object.name==='inverted-hull-outline'){outlineCount++;assert.ok(object.material.isShaderMaterial);assert.equal(object.material.side,THREE.BackSide)}})
    if(toy.kind==='kid'){assert.ok(model.userData.closedMouth);assert.ok(model.userData.openMouth)}
  }
  assert.ok(outlineCount>150)
  // CPU-side geometry verification only; this does not stand in for WebGL/browser QA.
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})}
  const machine=createMachine();machine.group.updateMatrixWorld(true)
  assert.equal(machine.fingers.length,3)
  assert.ok(machine.cable.geometry.isBufferGeometry)
  const bounds=new THREE.Box3().setFromObject(machine.group)
  assert.ok(bounds.max.y>7.9&&bounds.max.y<8.2)
  assert.ok(bounds.min.y>=0&&bounds.min.x<-2.5&&bounds.max.x>2.5)
  // Front opening has a clear path: intersecting the facade at its center reaches the interior, not a solid cabinet wall.
  const ray=new THREE.Raycaster(new THREE.Vector3(EXIT.x,1.35,4),new THREE.Vector3(0,0,-1))
  const hit=ray.intersectObject(machine.group,true)[0]
  assert.ok(hit);assert.ok(hit.point.z<2,'No facade panel blocks the prize opening')
  console.log(`✓ 15 procedural 3D toys, 6 shapes, shader outlines (${outlineCount}), expressions, three-finger claw and open prize hatch`)
}
