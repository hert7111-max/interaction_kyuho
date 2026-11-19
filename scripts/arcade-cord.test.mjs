import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {ArcadeCord} from '../src/arcade-cord.ts'
function center(cord,ring){const a=cord.mesh.geometry.getAttribute('position'),p=new THREE.Vector3();for(let i=0;i<6;i++)p.add(new THREE.Vector3().fromBufferAttribute(a,ring*7+i));return p.multiplyScalar(1/6)}
function near(a,b){assert.ok(a.distanceTo(b)<.00001,`${a.toArray()} != ${b.toArray()}`)}
test('One continuous cable reaches both the controller plug and monitor socket exactly',()=>{
  const cord=new ArcadeCord(),start=new THREE.Vector3(.4,2.1,3.7),end=new THREE.Vector3(-2.1,1.21,.53)
  cord.update(start,end);near(center(cord,0),start);near(center(cord,48),end)
  assert.ok(cord.mesh.geometry.getAttribute('position').array.every(Number.isFinite))
  for(let i=1;i<=48;i++)assert.ok(center(cord,i).distanceTo(center(cord,i-1))<.25)
})
test('Camera-relative controller motion and portrait scaling keep the other end fixed in world space',()=>{
  const camera=new THREE.PerspectiveCamera(47,16/9,.05,50),controller=new THREE.Group(),plug=new THREE.Object3D(),cord=new ArcadeCord(),end=new THREE.Vector3(-2.1,1.21,.53)
  camera.add(controller);controller.add(plug);controller.position.set(0,-.47,-2.65);controller.rotation.x=-.37;plug.position.set(0,.37,-.085)
  for(const aspect of [16/9,9/16]){
    camera.position.set(.85,3.05,aspect>1?6.35:11.0);camera.lookAt(0,1.28,-.4);controller.scale.setScalar(Math.min(1,aspect/1.15));camera.updateMatrixWorld(true)
    const start=plug.getWorldPosition(new THREE.Vector3());cord.update(start,end);near(center(cord,0),start);near(center(cord,48),end)
  }
})
test('Recoil and animation update the same cable buffers without accumulating geometry',()=>{
  const cord=new ArcadeCord(),geometry=cord.mesh.geometry,positions=geometry.getAttribute('position').array,normals=geometry.getAttribute('normal').array,end=new THREE.Vector3(-2.1,1.21,.53)
  for(let i=0;i<120;i++){const start=new THREE.Vector3(.4,2.1+Math.sin(i)*.02,3.7);cord.update(start,end);near(center(cord,0),start)}
  assert.equal(cord.mesh.geometry,geometry);assert.equal(geometry.getAttribute('position').array,positions);assert.equal(geometry.getAttribute('normal').array,normals)
})
