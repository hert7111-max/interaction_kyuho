import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {ArcadeCord} from '../src/arcade-cord.ts'
import {arcadeView,CONTROLLER_Y} from '../src/arcade-view.ts'
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
  camera.add(controller);controller.add(plug);controller.position.set(0,CONTROLLER_Y,-3.15);controller.rotation.x=-.28;plug.position.set(0,.37,-.085)
  for(const aspect of [16/9,9/16]){
    const view=arcadeView(aspect);camera.fov=view.fov;camera.position.set(...view.position);camera.lookAt(...view.target);controller.scale.setScalar(view.controllerScale);camera.updateMatrixWorld(true)
    const start=plug.getWorldPosition(new THREE.Vector3());cord.update(start,end);near(center(cord,0),start);near(center(cord,48),end)
  }
})
test('Recoil and animation update the same cable buffers without accumulating geometry',()=>{
  const cord=new ArcadeCord(),geometry=cord.mesh.geometry,positions=geometry.getAttribute('position').array,normals=geometry.getAttribute('normal').array,end=new THREE.Vector3(-2.1,1.21,.53)
  for(let i=0;i<120;i++){const start=new THREE.Vector3(.4,2.1+Math.sin(i)*.02,3.7);cord.update(start,end);near(center(cord,0),start)}
  assert.equal(cord.mesh.geometry,geometry);assert.equal(geometry.getAttribute('position').array,positions);assert.equal(geometry.getAttribute('normal').array,normals)
})

test('Seated framing keeps the CRT inside landscape and portrait views and the desktop horizon nearly level',()=>{
 for(const aspect of [2.1,16/9,4/3,9/16]){
  const v=arcadeView(aspect),camera=new THREE.PerspectiveCamera(v.fov,aspect,.05,50);camera.position.set(...v.position);camera.lookAt(...v.target);camera.updateMatrixWorld(true)
  for(const x of [-2.25,2.25])for(const y of [.23,3.65]){const p=new THREE.Vector3(x,y,.43).project(camera);assert.ok(Math.abs(p.x)<.98);assert.ok(Math.abs(p.y)<.98)}
  const a=new THREE.Vector3(-3,0,1).project(camera),b=new THREE.Vector3(3,0,1).project(camera);assert.ok(Math.abs(a.y-b.y)<.02)
  const direction=camera.getWorldDirection(new THREE.Vector3());assert.ok(-direction.y<.21,'the tabletop should not be seen from a steep overhead angle')
 }
})
