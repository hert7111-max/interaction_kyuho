import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {FingertipDatamosh,fingertipRadius,GLITCH_RADIUS_SCALE,GLITCH_GLYPHS} from '../src/particle-engine.ts'
function advance(e,seconds){for(let t=0;t<seconds;t+=1/60)e.update(1/60)}
test('Fingertips activate background, edges and all four screen quadrants without any face detection',()=>{
  const e=new FingertipDatamosh()
  for(const p of [{x:.07,y:.08},{x:.93,y:.08},{x:.07,y:.92},{x:.93,y:.92},{x:.5,y:.5}]){
    assert.equal(e.touch(p,null,.045),true);assert.ok(e.sample(p)>.95)
  }
  assert.equal(e.stage,'glitch');assert.equal(e.touch({x:NaN,y:.5},null,.05),false)
  e.reset();assert.equal(e.touch({x:0,y:.5},null,.045),true);assert.ok(e.sample({x:.002,y:.5})>.95)
})
test('Glitch radius is four times the former tip radius and remains aspect-correct',()=>{
  assert.equal(GLITCH_RADIUS_SCALE,4)
  const r=fingertipRadius({x:.5,y:.4},{x:.5,y:.43},16/9,720)
  assert.ok(Math.abs(r-.03*.34*4)<1e-8)
  assert.equal(fingertipRadius({x:.5,y:.5},{x:.5,y:.5},1,720),20/720)
  assert.equal(fingertipRadius({x:.5,y:.5},{x:.5,y:.9},1,720),68/720)
  for(const aspect of [9/16,16/9]){
    const e=new FingertipDatamosh(300,300);e.aspect=aspect;e.touch({x:.5,y:.5},null,r)
    assert.ok(e.sample({x:.5+r*.65/aspect,y:.5})>.9);assert.ok(e.sample({x:.5,y:.5+r*.65})>.9)
    assert.equal(e.sample({x:.5+r*1.2/aspect,y:.5}),0);assert.equal(e.sample({x:.5,y:.5+r*1.2}),0)
  }
})
test('Moving hands leave broad continuous corruption and tracking jumps do not bridge the screen',()=>{
  const e=new FingertipDatamosh();e.touch({x:.5,y:.7},{x:.4,y:.7},.05)
  assert.ok(e.sample({x:.45,y:.7})>.95);assert.ok(e.sample({x:.45,y:.73})>.9)
  assert.equal(e.sample({x:.45,y:.78}),0)
  e.reset();e.touch({x:.9,y:.9},{x:.1,y:.1},.05)
  assert.equal(e.sample({x:.5,y:.5}),0);assert.ok(e.sample({x:.9,y:.9})>.9)
})
test('Strong traces persist, recover independently and reuse exactly cleared GPU buffers',()=>{
  const e=new FingertipDatamosh(),field=e.field,energy=e.energy
  e.touch({x:.3,y:.5},null,.05);advance(e,.5)
  assert.equal(e.stage,'recovering');assert.ok(e.sample({x:.3,y:.5})>.7)
  e.touch({x:.7,y:.5},null,.05);advance(e,1.4)
  assert.equal(e.sample({x:.3,y:.5}),0);assert.ok(e.sample({x:.7,y:.5})>0)
  advance(e,.6);assert.equal(e.stage,'idle');assert.ok(field.every(v=>v===0));assert.equal(e.field,field);assert.equal(e.energy,energy)
})
test('Ten tips and repeated strokes stay bounded; code atlas contains English and hexadecimal symbols',()=>{
  const e=new FingertipDatamosh()
  for(let repeat=0;repeat<4;repeat++)for(let i=0;i<10;i++)e.touch({x:.14+(i%5)*.18,y:.25+Math.floor(i/5)*.5},null,.065)
  assert.equal(e.activeCount,e.energy.filter(v=>v>0).length)
  assert.ok(e.activeCount>0&&e.activeCount<e.energy.length*.5)
  assert.equal(GLITCH_GLYPHS.slice(0,16),'0123456789ABCDEF');assert.equal(GLITCH_GLYPHS[14],'E');assert.equal(GLITCH_GLYPHS[27],'R');assert.equal(GLITCH_GLYPHS[36],'x')
  e.reset();assert.equal(e.stage,'idle');assert.ok(e.field.every(v=>v===0))
})
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
