import {test} from 'node:test'
import assert from 'node:assert/strict'
import {FingertipDatamosh,makeFaceFrame,insidePolygon,fingertipRadius} from '../src/particle-engine.ts'
function oval(x=.35,y=.2,width=.3,height=.5){return Array.from({length:36},(_,i)=>({x:x+width/2+Math.cos(i/36*Math.PI*2)*width/2,y:y+height/2+Math.sin(i/36*Math.PI*2)*height/2}))}
function setup(){const e=new FingertipDatamosh();e.setFace(makeFaceFrame(oval()));return e}
function advance(e,seconds){for(let t=0;t<seconds;t+=1/60)e.update(1/60)}
test('Face outline rejects missing, tiny and non-finite detections',()=>{
  assert.equal(makeFaceFrame([]),null);assert.equal(makeFaceFrame(oval(0,0,.001,.001)),null)
  assert.equal(makeFaceFrame(oval().map(p=>({x:NaN,y:p.y}))),null)
  assert.ok(insidePolygon({x:.5,y:.45},makeFaceFrame(oval()).contour))
})
test('Stationary fingertip contact affects a fingertip-sized patch, never the whole face',()=>{
  const e=setup(),tip={x:.5,y:.45},r=.015
  assert.equal(e.touch(tip,null,r),true);assert.equal(e.stage,'glitch');assert.ok(e.sample(tip)>.95)
  assert.equal(e.sample({x:.55,y:.45}),0);assert.equal(e.sample({x:.5,y:.55}),0)
  assert.ok(e.activeCount<e.energy.length*.02)
  for(let i=0;i<e.energy.length;i++)if(e.energy[i]){
    const x=e.face.x+(i%e.columns+.5)/e.columns*e.face.width,y=e.face.y+(Math.floor(i/e.columns)+.5)/e.rows*e.face.height
    assert.ok(Math.hypot((x-tip.x)*e.aspect,y-tip.y)<r)
  }
})
test('Only the swept fingertip path glitches; face corners, background and tracking jumps stay clean',()=>{
  const e=setup();assert.equal(e.touch({x:.1,y:.1},null,.02),false)
  assert.equal(e.touch({x:.355,y:.205},null,.02),false)
  assert.equal(e.touch({x:.53,y:.45},{x:.47,y:.45},.014),true)
  assert.ok(e.sample({x:.5,y:.45})>.9);assert.equal(e.sample({x:.5,y:.49}),0)
  e.reset();e.touch({x:.56,y:.45},{x:.1,y:.45},.014)
  assert.equal(e.sample({x:.5,y:.45}),0);assert.ok(e.sample({x:.56,y:.45})>.9)
})
test('Contact traces fade independently and restore exactly, without starting a face-wide sequence',()=>{
  const e=setup(),field=e.field,energy=e.energy
  e.touch({x:.47,y:.45},null,.014);advance(e,.7)
  assert.equal(e.stage,'recovering');assert.ok(e.sample({x:.47,y:.45})<.6)
  e.touch({x:.53,y:.45},null,.014);advance(e,.7)
  assert.equal(e.sample({x:.47,y:.45}),0);assert.ok(e.sample({x:.53,y:.45})>0)
  advance(e,1);assert.equal(e.stage,'idle');assert.ok(field.every(v=>v===0));assert.equal(e.field,field);assert.equal(e.energy,energy)
})
test('Ten simultaneous fingertips remain local, use measured tip size and reset immediately',()=>{
  const e=setup(),r=fingertipRadius({x:.5,y:.45},{x:.5,y:.48},e.face,e.aspect,720)
  assert.ok(r>=5/720&&r<=17/720)
  for(let i=0;i<10;i++)e.touch({x:.42+(i%5)*.04,y:.38+Math.floor(i/5)*.12},null,r)
  assert.ok(e.activeCount<e.energy.length*.15)
  e.reset();assert.equal(e.stage,'idle');assert.ok(e.field.every(v=>v===0))
})
