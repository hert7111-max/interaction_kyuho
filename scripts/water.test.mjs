import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cameraToSurface, coverScale, smoothPoint, TIP_INDICES } from '../src/water-math.ts'
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} should equal ${b}`)
test('Ten independent fingertips are selected across two hands',()=>{
  assert.deepEqual(TIP_INDICES,[4,8,12,16,20]);assert.equal(new Set(['Left','Right'].flatMap(side=>TIP_INDICES.map(tip=>`${side}-${tip}`))).size,10)
})
test('Mirror and vertical coordinates match a camera without cropping',()=>{
  assert.deepEqual(cameraToSurface({x:.2,y:.3},16/9,16/9,true),{x:.8,y:.7})
  assert.deepEqual(cameraToSurface({x:.2,y:.3},16/9,16/9,false),{x:.2,y:.7})
})
test('Object-fit cover preserves registration in portrait and ultrawide viewports',()=>{
  for(const [videoAspect,surfaceAspect] of [[16/9,9/16],[4/3,21/9],[16/9,1]]){
    const cover=coverScale(videoAspect,surfaceAspect)
    for(const mirror of [false,true])for(const point of [{x:.5,y:.5},{x:.4,y:.7}]){
      const surface=cameraToSurface(point,videoAspect,surfaceAspect,mirror)
      const cameraX=(surface.x-.5)*cover.x+.5
      near(mirror?1-cameraX:cameraX,point.x)
      near((surface.y-.5)*cover.y+.5,1-point.y)
    }
  }
})
test('Smoothing converges without overshoot and scales with elapsed time',()=>{
  let point={x:0,y:0}
  for(let i=0;i<30;i++)point=smoothPoint(point,{x:1,y:.5},1/30)
  assert.ok(point.x>.999&&point.x<=1&&point.y<=.5)
  assert.ok(smoothPoint({x:0,y:0},{x:.1,y:0},1/15).x>smoothPoint({x:0,y:0},{x:.1,y:0},1/60).x)
})
