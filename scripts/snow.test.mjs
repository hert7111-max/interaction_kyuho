import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SnowWorld, HumanField, FogField, contactVelocity, isMouthOpen } from '../src/snow-physics.ts'
const flat={distance:(_x,y)=>500-y,normal:()=>({x:0,y:-1})}
const air={distance:()=>10000,normal:()=>({x:0,y:-1})}
const advance=(world,seconds,field=flat)=>{for(let t=0;t<seconds;t+=1/60)world.update(1/60,field)}
let seed=7;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
test('Coulomb friction sticks on flat contacts and allows a steep downhill slide',()=>{
  const flat=contactVelocity(1,10,0,-1);assert.ok(Math.abs(flat.x)<1e-8)
  const slope=contactVelocity(0,10,Math.SQRT1_2,-Math.SQRT1_2);assert.ok(slope.x>0&&slope.y>0)
})
test('Snow falls, collides, accumulates in multiple layers, and loses support when the body moves',()=>{
  const world=new SnowWorld(900,900,random);world.spawn(450,250,40,80);advance(world,7)
  const resting=world.particles.filter(p=>p.settled)
  assert.ok(resting.length>20,`${resting.length} flakes should rest on the silhouette`)
  assert.ok(Math.min(...resting.map(p=>p.y))<485,'Snow must accumulate above the first contact layer')
  assert.ok(world.particles.every(p=>p.y<501),'No flake tunnels inside the body')
  const average=resting.reduce((a,p)=>a+p.y,0)/resting.length
  advance(world,1,air)
  assert.equal(world.particles.filter(p=>p.settled).length,0,'Removing support releases the pile')
  assert.ok(world.particles.reduce((a,p)=>a+p.y,0)/world.particles.length>average+20)
})
test('Snow slides off a steep surface under gravity',()=>{
  const n=1/Math.sqrt(2),slope={distance:(x,y)=>(500+(x-450)-y)*n,normal:()=>({x:n,y:-n})}
  const world=new SnowWorld(1500,900,()=>.5);world.spawn(450,490,0,1);advance(world,2,slope)
  assert.ok(world.particles[0].x>460);assert.ok(world.particles[0].y>500)
})
test('Swept collision catches a fast flake crossing a thin silhouette',()=>{
  const thin={distance:(_x,y)=>y<500?500-y:y>510?y-510:-Math.min(y-500,510-y),normal:(_x,y)=>({x:0,y:y<505?-1:1})}
  const world=new SnowWorld(900,900,()=>.5);world.spawn(450,480,0);world.particles[0].vy=6000;world.update(1/120,thin)
  assert.ok(world.particles[0].y<500)
})
test('HumanSeg mask uses cover + mirror coordinates and produces outward normals',()=>{
  const field=new HumanField(900,900,90),mask=new Uint8Array(90*90)
  for(let y=45;y<90;y++)for(let x=20;x<70;x++)mask[y*90+x]=1
  field.setMask(mask);assert.ok(field.distance(450,400)>0);assert.ok(field.distance(450,600)<0);assert.ok(field.normal(450,450).y<-.9)
  const probability=new Float32Array(100*100)
  for(let y=30;y<100;y++)for(let x=0;x<35;x++)probability[y*100+x]=1
  field.update(probability,100,100,1,true)
  assert.ok(field.distance(800,600)<0);assert.ok(field.distance(100,600)>0)
  field.clear();assert.ok(field.distance(800,600)>1000)
})
test('Breath condenses, fingertip segments erase continuous strokes, and fog evaporates',()=>{
  const fog=new FogField(1,100);fog.breathe(.5,.5,.4,.3,1)
  const index=50*100+50,before=fog.density[index];assert.ok(before>.5)
  fog.erase({x:.2,y:.5},{x:.8,y:.5},.035)
  assert.equal(fog.density[index],0);assert.equal(fog.density[50*100+40],0)
  fog.breathe(.5,.5,.4,.3,1);assert.equal(fog.density[index],0,'Fresh strokes resist immediate re-condensation')
  const other=40*100+50,amount=fog.density[other];fog.decay(13);assert.ok(fog.density[other]<amount*.38)
})
test('Mouth-open detection has hysteresis and does not trigger on closed lips',()=>{
  assert.equal(isMouthOpen(.02,.4,.02),false)
  assert.equal(isMouthOpen(.1,.4,.05),true)
  assert.equal(isMouthOpen(.045,.4,.05,true),true)
  assert.equal(isMouthOpen(.02,.4,.05,true),false)
})
