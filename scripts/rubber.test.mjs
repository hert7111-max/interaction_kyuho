import {test} from 'node:test'
import assert from 'node:assert/strict'
import {RubberFace,flow,pickTriangle} from '../src/rubber-engine.ts'
const near=(a,b,e=.002)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`)
const hand=(x,y,gap=.01)=>{const h=Array.from({length:21},()=>({x,y}));h[0]={x,y:y-.15};h[9]={x,y:y+.02};h[5]={x:x-.08,y};h[17]={x:x+.08,y};h[4]={x:x-gap/2,y};h[8]={x:x+gap/2,y};return h}
test('Pinch starts only on the face; an outside pinch cannot enter while held',()=>{
 const e=new RubberFace();e.hand('a',hand(.1,.1),()=>null);assert.equal(e.handles.size,0);e.hand('a',hand(.5,.5),p=>p);assert.equal(e.handles.size,0)
 e.hand('a',hand(.5,.5,.15),p=>p);e.hand('a',hand(.5,.5),p=>p);assert.equal(e.handles.size,1)
})
test('Long pulls pin the exact material point, preserve remote pixels and have positive local Jacobians',()=>{
 const a={x:.5,y:.5},offset={x:1.4,y:.35},tip=flow(a,a,offset,.75);near(tip.x,1.9);near(tip.y,.85)
 const outside=flow({x:0,y:0},a,offset,.75);near(outside.x,0);near(outside.y,0)
 const eps=.0001
 for(let y=.05;y<1;y+=.035)for(let x=.05;x<1;x+=.035){const p=flow({x,y},a,offset,.75),q=flow({x:x+eps,y},a,offset,.75),r=flow({x,y:y+eps},a,offset,.75);assert.ok((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x)>0)}
})
test('Held skin follows, opening and tracking loss spring back with a damped overshoot',()=>{
 const e=new RubberFace();e.hand('a',hand(.5,.5),p=>p);e.hand('a',hand(.9,.6),p=>p)
 for(let i=0;i<60;i++)e.update(1/60)
 near(e.deform({x:.5,y:.5}).x,.9)
 e.hand('a',hand(.9,.6,.15),p=>p)
 let overshoot=false
 for(let i=0;i<180;i++){e.update(1/60);if(e.deform({x:.5,y:.5}).x<.499)overshoot=true}
 assert.ok(overshoot);assert.equal(e.handles.size,0)
 e.hand('b',hand(.5,.5),p=>p);e.retain(new Set());assert.equal(e.handles.get('b').held,false);e.reset();assert.equal(e.handles.size,0)
})
test('Picking recovers barycentric material coordinates and rejects outside or degenerate triangles',()=>{
 const weights=pickTriangle({x:.25,y:.25},{x:0,y:0},{x:1,y:0},{x:0,y:1});assert.deepEqual(weights,[.5,.25,.25]);assert.equal(pickTriangle({x:2,y:2},{x:0,y:0},{x:1,y:0},{x:0,y:1}),null);assert.equal(pickTriangle({x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}),null)
})
test('Dedicated runtime infers full face and both hands on every frame without changing archived runtimes',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:vm}=await import('node:vm')
 let faceCalls=0,handCalls=0
 const face=Array.from({length:478},(_,i)=>({x:i/478,y:.5,z:0}))
 class PapaVisionRuntime{constructor(){this.hands={detectForVideo(){handCalls++;return{landmarks:[[],[]],handedness:[]}}};this.face={detectForVideo(){faceCalls++;return{faceLandmarks:[face]}}}}}
 const self={},context=vm.createContext({self,PapaVisionRuntime,performance})
 vm.runInContext(await readFile(new URL('../public/rubber-runtime.js',import.meta.url),'utf8'),context)
 const runtime=new self.RubberVisionRuntime()
 for(let i=0;i<3;i++){const data=runtime.detect({},i);assert.equal(data.face.length,478);assert.equal(data.landmarks.length,2)}
 assert.equal(handCalls,3);assert.equal(faceCalls,3)
})
test('Both hands pin separate cheeks simultaneously, including overlapping influence regions',()=>{
 const e=new RubberFace(),left={x:.38,y:.5},right={x:.62,y:.5}
 e.hand('Left',hand(left.x,left.y),p=>p);e.hand('Right',hand(right.x,right.y),p=>p)
 assert.equal(e.handles.size,2)
 e.hand('Left',hand(.08,.58),p=>p);e.hand('Right',hand(.94,.57),p=>p)
 for(let i=0;i<90;i++)e.update(1/60)
 near(e.deform(left).x,.08);near(e.deform(left).y,.58);near(e.deform(right).x,.94);near(e.deform(right).y,.57)
 const eps=.0001
 for(let y=.1;y<.95;y+=.07)for(let x=.1;x<.95;x+=.07){const p=e.deform({x,y}),q=e.deform({x:x+eps,y}),r=e.deform({x,y:y+eps});assert.ok((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x)>0,'two-hand surface must not fold')}
 // Releasing one hand must leave the other hand's material pinned throughout the rebound.
 e.hand('Left',hand(.08,.58,.15),p=>p)
 for(let i=0;i<180;i++){e.update(1/60);near(e.deform(right).x,.94);near(e.deform(right).y,.57)}
 assert.equal(e.handles.size,1)
 e.retain(new Set());for(let i=0;i<180;i++)e.update(1/60)
 assert.equal(e.handles.size,0);near(e.deform(left).x,left.x)
})
