import {test} from 'node:test'
import assert from 'node:assert/strict'
import {FaceParticles,makeFaceFrame,insidePolygon,strokeTouchesFace} from '../src/particle-engine.ts'
function oval(x=.35,y=.2,width=.3,height=.5){return Array.from({length:36},(_,i)=>({x:x+width/2+Math.cos(i/36*Math.PI*2)*width/2,y:y+height/2+Math.sin(i/36*Math.PI*2)*height/2}))}
function setup(){const engine=new FaceParticles(32,40);engine.setFace(makeFaceFrame(oval()));return engine}
function advance(engine,seconds){for(let t=0;t<seconds;t+=1/60)engine.update(1/60)}
test('Face bounds and polygon clipping reject missing, tiny and non-finite detections',()=>{
  assert.equal(makeFaceFrame([]),null)
  assert.equal(makeFaceFrame(oval(0,0,.001,.001)),null)
  assert.equal(makeFaceFrame(oval().map(p=>({x:NaN,y:p.y}))),null)
  const face=makeFaceFrame(oval());assert.ok(Math.abs(face.width-.3)<1e-8)
  assert.ok(insidePolygon({x:.5,y:.45},face.contour));assert.ok(!insidePolygon({x:.05,y:.05},face.contour))
})
test('Only a moving finger crossing the face initiates the effect',()=>{
  const engine=setup()
  assert.equal(engine.push({x:.5,y:.5},{x:.5,y:.5}),false)
  assert.equal(engine.push({x:.05,y:.05},{x:.15,y:.1}),false)
  assert.equal(engine.stage,'idle')
  assert.equal(strokeTouchesFace({x:.1,y:.45},{x:.9,y:.45},engine.face,16/9),true)
  assert.equal(engine.push({x:.45,y:.5},{x:.55,y:.5}),true)
  assert.equal(engine.stage,'glitch')
  advance(engine,.2);assert.equal(engine.stage,'glitch');assert.ok(engine.glitch>.8)
})
test('Face pixels become independently moving particles after the datamosh lead-in',()=>{
  const engine=setup();engine.push({x:.45,y:.5},{x:.55,y:.5});advance(engine,1.3)
  assert.equal(engine.stage,'scattering')
  assert.ok(engine.alpha.some(value=>value>.9));assert.ok(engine.holes.some(value=>value>200));assert.ok(engine.offset.some(value=>Math.abs(value)>.05))
  for(let i=0;i<engine.count;i++)if(engine.active[i])assert.ok(insidePolygon({x:engine.snapshotUV[i*2],y:engine.snapshotUV[i*2+1]},engine.face.contour))
})
test('Particles reassemble automatically into the current face, with exact cleanup and reusable buffers',()=>{
  const engine=setup(),positions=engine.positions,holes=engine.holes,alpha=engine.alpha
  engine.push({x:.45,y:.5},{x:.55,y:.5});advance(engine,1.5)
  engine.setFace(makeFaceFrame(oval(.45,.25,.25,.45)));advance(engine,1.1)
  assert.equal(engine.stage,'returning')
  advance(engine,3)
  assert.equal(engine.stage,'idle');assert.ok(engine.offset.every(value=>value===0));assert.ok(alpha.every(value=>value===0));assert.ok(holes.every(value=>value===0))
  assert.equal(engine.positions,positions);assert.equal(engine.holes,holes);assert.equal(engine.alpha,alpha)
})
test('Multiple fingers share one bounded burst and manual reset returns the live camera immediately',()=>{
  const engine=setup();engine.push({x:.45,y:.5},{x:.55,y:.5});const serial=engine.burstSerial
  for(let i=0;i<90;i++){engine.push({x:.55,y:.5},{x:.5,y:.53});engine.update(1/60)}
  assert.equal(engine.burstSerial,serial);assert.ok(engine.returnAt<=engine.start+4.1)
  engine.reset();assert.equal(engine.stage,'idle');assert.ok(engine.alpha.every(value=>value===0))
  engine.push({x:.45,y:.5},{x:.55,y:.5});assert.equal(engine.burstSerial,serial+1)
})
