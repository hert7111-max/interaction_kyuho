import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {handGeometry,UnifiedHand} from '../src/arcade-hand.ts'
function topology(geometry){
 const index=geometry.index.array,n=geometry.getAttribute('position').count,parent=Array.from({length:n},(_,i)=>i),edges=new Map()
 const root=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x}
 for(let i=0;i<index.length;i+=3){const a=index[i],b=index[i+1],c=index[i+2];parent[root(a)]=root(b);parent[root(b)]=root(c);for(const [x,y]of[[a,b],[b,c],[c,a]]){const key=x<y?`${x}:${y}`:`${y}:${x}`;edges.set(key,(edges.get(key)||0)+1)}}
 return{components:new Set(parent.map((_,i)=>root(i))).size,open:[...edges.values()].filter(n=>n!==2).length}
}
test('Each hand is a single closed skin surface, with no detached thumb, palm or wrist boundary',()=>{
 for(const side of [-1,1]){const g=handGeometry(side);assert.deepEqual(topology(g),{components:1,open:0});g.dispose()}
})
test('Both mirrored hands have outward winding and smooth finite unit-length skin normals',()=>{
 for(const side of [-1,1]){
  const g=handGeometry(side),p=g.getAttribute('position'),n=g.getAttribute('normal'),index=g.index.array;let volume=0
  for(let i=0;i<index.length;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,index[i]),b=new THREE.Vector3().fromBufferAttribute(p,index[i+1]),c=new THREE.Vector3().fromBufferAttribute(p,index[i+2]);volume+=a.dot(b.cross(c))/6}
  assert.ok(volume>0);assert.ok(p.array.every(Number.isFinite))
  for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.0001)
  g.dispose()
 }
})
test('Thumb presses animate the joined skin while the wrist stays still and the same geometry is retained',()=>{
 const skin=new THREE.MeshStandardMaterial(),nail=new THREE.MeshStandardMaterial(),hand=new UnifiedHand(1,skin,nail),geometry=hand.skin.geometry,p=geometry.getAttribute('position'),weights=geometry.getAttribute('skinWeight'),indices=geometry.getAttribute('skinIndex')
 hand.group.updateMatrixWorld(true);hand.skin.skeleton.update()
 let tip=-1,wrist=-1
 for(let i=0;i<p.count;i++){if(indices.getY(i)===1&&weights.getY(i)>.999&&p.getY(i)>.04)tip=i;if(weights.getX(i)>.999&&p.getY(i)<-.9)wrist=i}
 assert.ok(tip>=0&&wrist>=0)
 const before=hand.skin.getVertexPosition(tip,new THREE.Vector3()).clone(),fixed=hand.skin.getVertexPosition(wrist,new THREE.Vector3()).clone()
 hand.pose(1,-1,1,[1,1,1,1]);hand.group.updateMatrixWorld(true);hand.skin.skeleton.update()
 const after=hand.skin.getVertexPosition(tip,new THREE.Vector3());assert.ok(Math.abs(after.x-before.x-.045)<.0001);assert.ok(Math.abs(after.y-before.y+.042)<.0001);assert.ok(Math.abs(after.z-before.z+.032)<.0001)
 assert.ok(hand.skin.getVertexPosition(wrist,new THREE.Vector3()).distanceTo(fixed)<.00001);assert.equal(hand.skin.geometry,geometry);assert.deepEqual(topology(geometry),{components:1,open:0})
 geometry.dispose();skin.dispose();nail.dispose()
})
test('Skin weights are normalized and only one skin mesh is used for all five fingers and the forearm',()=>{
 const material=new THREE.MeshStandardMaterial(),nail=new THREE.MeshStandardMaterial(),hand=new UnifiedHand(-1,material,nail),g=hand.skin.geometry,w=g.getAttribute('skinWeight'),j=g.getAttribute('skinIndex'),used=new Set();let skins=0
 for(let i=0;i<w.count;i++){assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<.00001);if(w.getY(i)>.1)used.add(j.getY(i))}
 hand.group.traverse(o=>{if(o.isMesh&&o.material===material)skins++});assert.equal(skins,1);assert.deepEqual([...used].sort(),[1,2,3,4,5]);g.dispose();material.dispose();nail.dispose()
})
test('Both index fingertips sit visibly above the controller and visibly depress on firing while the wrist remains fixed',()=>{
 for(const side of [-1,1]){
  const skin=new THREE.MeshStandardMaterial(),nail=new THREE.MeshStandardMaterial(),hand=new UnifiedHand(side,skin,nail),g=hand.skin.geometry,p=g.getAttribute('position'),w=g.getAttribute('skinWeight'),j=g.getAttribute('skinIndex')
  let index=-1;for(let i=0;i<p.count;i++)if(j.getY(i)===2&&w.getY(i)>.99&&p.getY(i)>.43&&p.getZ(i)>.16)index=i
  assert.ok(index>=0,'visible index skin on the front of the shoulder button');assert.equal(hand.group.getObjectByName('index-nail')?.parent,hand.skin.skeleton.bones[2])
  hand.group.updateMatrixWorld(true);hand.skin.skeleton.update();const before=hand.skin.getVertexPosition(index,new THREE.Vector3()).clone()
  hand.pose(0,0,1,[.5,.5,.5,.5]);hand.group.updateMatrixWorld(true);hand.skin.skeleton.update();const after=hand.skin.getVertexPosition(index,new THREE.Vector3())
  assert.ok(before.y-after.y>.039);assert.ok(before.z-after.z>.029)
  g.dispose();skin.dispose();nail.dispose()
 }
})
