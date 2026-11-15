import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {RubberSurface,PinchInput,pinchPose,RUBBER_RECOVERY_SECONDS} from '../src/particle-engine.ts'
const near=(actual,expected,epsilon=.002)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} != ${expected}`)
function advance(e,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)e.update(1/60)}
function hand(x=.5,y=.5,gap=.01){const points=Array.from({length:21},()=>({x,y}));points[0]={x,y:y-.12};points[9]={x,y:y+.04};points[5]={x:x-.07,y};points[17]={x:x+.07,y};points[4]={x:x-gap/2,y};points[8]={x:x+gap/2,y};return points}
function stretch(e,id='left',from={x:.4,y:.5},to={x:.66,y:.55}){e.grab(id,from,.17);for(let i=1;i<=60;i++){e.move(id,{x:from.x+(to.x-from.x)*i/60,y:from.y+(to.y-from.y)*i/60});e.update(1/60)}advance(e,.2)}
test('Open hands do not deform the image; palm-relative pinch hysteresis avoids flickering',()=>{
  const e=new RubberSurface(96,96),input=new PinchInput(e);e.aspect=1
  input.hand('left',hand(.5,.5,.13),0);assert.equal(e.grips.size,0);assert.equal(e.deformed,false)
  input.hand('left',hand(.5,.5,.015),50);assert.equal(e.grips.size,1)
  assert.equal(pinchPose(hand(.5,.5,.05),true,1).closed,true)
  assert.equal(pinchPose(hand(.5,.5,.05),false,1).closed,false)
  input.hand('left',hand(.5,.5,.13),100);assert.equal(e.grips.size,0)
  assert.equal(pinchPose([],false,1),null)
})
test('A pinched material point follows a long pull while distant background stays unchanged and the map never folds',()=>{
  const e=new RubberSurface();stretch(e)
  const material=e.sourceAt({x:.66,y:.55});near(material.x,.4,.012);near(material.y,.5,.012)
  const outside=e.sourceAt({x:.1,y:.15});near(outside.x,.1);near(outside.y,.15)
  for(let y=0;y<e.rows-1;y++)for(let x=0;x<e.columns-1;x++){
    const m=e.coordinates,i=(y*e.columns+x)*2,j=i+2,k=i+e.columns*2
    const determinant=(m[j]-m[i])*(m[k+1]-m[i+1])-(m[j+1]-m[i+1])*(m[k]-m[i])
    assert.ok(determinant>0,'Local material map must stay continuous without triangle flips')
  }
})
test('A held pinch preserves the stretch; after release recovery is very slow, monotonic and exact at 16 seconds',()=>{
  const e=new RubberSurface(128,128),p={x:.66,y:.55};stretch(e);advance(e,2)
  const held=e.sourceAt(p);advance(e,3);near(e.sourceAt(p).x,held.x,.00001)
  e.release('left');const initial=p.x-e.sourceAt(p).x
  advance(e,2);assert.ok(p.x-e.sourceAt(p).x>initial*.90)
  let previous=initial
  for(let i=0;i<12;i++){advance(e,1);const residual=p.x-e.sourceAt(p).x;assert.ok(residual<=previous+.0001);previous=residual}
  assert.equal(e.stage,'returning');advance(e,2.1);assert.equal(RUBBER_RECOVERY_SECONDS,16);assert.equal(e.stage,'idle');near(e.sourceAt(p).x,p.x,.00001)
})
test('Both hands pull independent regions and re-grabbing picks up the already stretched material',()=>{
  const e=new RubberSurface(128,128);e.aspect=1
  stretch(e,'left',{x:.28,y:.3},{x:.42,y:.3});stretch(e,'right',{x:.72,y:.7},{x:.57,y:.7})
  assert.equal(e.grips.size,2);near(e.sourceAt({x:.42,y:.3}).x,.28,.014);near(e.sourceAt({x:.57,y:.7}).x,.72,.014)
  e.releaseAll();advance(e,2)
  const source=e.sourceAt({x:.42,y:.3});e.grab('again',{x:.42,y:.3},.17);e.move('again',{x:.46,y:.3});advance(e,.3)
  near(e.sourceAt({x:.46,y:.3}).x,source.x,.014)
})
test('Lost/stale hands and tracking jumps release safely; reset reuses and restores all source-coordinate buffers',()=>{
  const e=new RubberSurface(96,96),input=new PinchInput(e),coordinates=e.coordinates,field=e.field
  input.hand('left',hand(),0);input.hand('left',hand(.56,.5),80);advance(e,.2);assert.equal(e.stage,'holding')
  input.retain(new Set());assert.equal(e.grips.size,0);assert.equal(e.stage,'returning')
  input.hand('left',hand(.56,.5),100);input.hand('left',hand(.9,.5),500);near(e.grips.get('left').point.x,.9)
  assert.equal(e.move('left',{x:.05,y:.05}),false);assert.equal(e.grips.size,0)
  input.releaseAll();e.reset();assert.equal(e.stage,'idle');assert.equal(e.coordinates,coordinates);assert.equal(e.field,field)
  for(let y=0;y<e.rows;y++)for(let x=0;x<e.columns;x++){const i=(y*e.columns+x)*2;near(coordinates[i],x/(e.columns-1),1e-6);near(coordinates[i+1],y/(e.rows-1),1e-6)}
})
test('Packed UVs retain 16-bit accuracy at the edge and in portrait without requiring float textures',()=>{
  const e=new RubberSurface(128,128);e.aspect=9/16;stretch(e,'left',{x:.12,y:.4},{x:.40,y:.6})
  assert.ok(e.coordinates.every(v=>Number.isFinite(v)&&v>=0&&v<=1))
  for(let i=0;i<e.coordinates.length;i+=2){const k=i*2;near((fieldValue(e.field,k))/65535,e.coordinates[i],1/65535);near(fieldValue(e.field,k+2)/65535,e.coordinates[i+1],1/65535)}
})
function fieldValue(field,k){return field[k]*256+field[k+1]}
test('Particle initializes hands only while the archived Papa runtime still initializes hands and face',async()=>{
  const calls=[],closed=[]
  const makeTask=name=>({createFromOptions:async()=>{calls.push(name);return{detectForVideo:()=>name==='hands'?{landmarks:[[{},{}]],handedness:[]}:{faceLandmarks:[]},close:()=>closed.push(name)}}})
  const edges=[{start:0,end:1},{start:1,end:2},{start:2,end:0}]
  const FaceLandmarker={...makeTask('face'),FACE_LANDMARKS_LEFT_EYE:edges,FACE_LANDMARKS_RIGHT_EYE:edges}
  const self={},context=vm.createContext({self,performance,Vision:{FilesetResolver:{forVisionTasks:async()=>({wasmBinaryPath:'test.wasm'})},HandLandmarker:makeTask('hands'),FaceLandmarker}})
  vm.runInContext(await readFile(new URL('../public/papa-runtime.js',import.meta.url),'utf8'),context)
  vm.runInContext(await readFile(new URL('../public/particle-runtime.js',import.meta.url),'utf8'),context)
  const particle=new self.ParticleVisionRuntime();await particle.init('https://example.test/')
  assert.deepEqual(calls,['hands']);assert.equal(particle.detect({},1).landmarks.length,1);particle.close();assert.deepEqual(closed,['hands'])
  calls.length=closed.length=0
  const papa=new self.PapaVisionRuntime();await papa.init('https://example.test/')
  assert.deepEqual(calls,['hands','face']);assert.equal(papa.loops.length,2);papa.close();assert.deepEqual(closed,['hands','face'])
})
