import * as THREE from 'three'
import handData from './arcade-hand-mesh.ts'
function bytes(text:string){const source=atob(text),result=new Uint8Array(source.length);for(let i=0;i<source.length;i++)result[i]=source.charCodeAt(i);return result}
const packed=bytes(handData.positions),quantized=new Uint16Array(packed.buffer),indexBytes=bytes(handData.indices),indices=new Uint16Array(indexBytes.buffer),joints=bytes(handData.joints),weightBytes=bytes(handData.weights),weights=new Uint16Array(weightBytes.buffer),normalBytes=bytes(handData.normals),bakedNormals=new Int16Array(normalBytes.buffer)
/** One indexed, watertight skin mesh for the complete hand, including the thumb web and wrist. */
export function handGeometry(side:number){
  const count=handData.vertices,positions=new Float32Array(count*3),normals=new Int16Array(bakedNormals),uv=new Float32Array(count*2),skinIndex=new Uint16Array(count*4),skinWeight=new Float32Array(count*4),bounds=handData.bounds
  for(let i=0;i<count;i++){
    const x=bounds[0]!+quantized[i*3]!/65535*(bounds[3]!-bounds[0]!),y=bounds[1]!+quantized[i*3+1]!/65535*(bounds[4]!-bounds[1]!),z=bounds[2]!+quantized[i*3+2]!/65535*(bounds[5]!-bounds[2]!),weight=weights[i]!/65535
    normals[i*3]*=side
    positions[i*3]=x*side+(joints[i]===1?weight*(side>0?.065:.015):0);positions[i*3+1]=y;positions[i*3+2]=z
    uv[i*2]=quantized[i*3]!/65535;uv[i*2+1]=quantized[i*3+1]!/65535
    skinIndex[i*4+1]=joints[i]!;skinWeight[i*4]=1-weight;skinWeight[i*4+1]=weight
  }
  const mirrored=new Uint16Array(indices);if(side<0)for(let i=0;i<mirrored.length;i+=3){const b=mirrored[i+1]!;mirrored[i+1]=mirrored[i+2]!;mirrored[i+2]=b}
  const geometry=new THREE.BufferGeometry();geometry.setIndex(new THREE.BufferAttribute(mirrored,1));geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Int16BufferAttribute(normals,3,true));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));geometry.computeBoundingSphere();return geometry
}
export function handMaterials(){
  const width=512,height=1024,color=document.createElement('canvas'),bump=document.createElement('canvas');color.width=bump.width=width;color.height=bump.height=height
  const c=color.getContext('2d')!,b=bump.getContext('2d')!,image=c.createImageData(width,height),relief=b.createImageData(width,height)
  let seed=471
  for(let i=0;i<width*height;i++){seed=(seed*1664525+1013904223)>>>0;const n=(seed/4294967296-.5),k=i*4;image.data[k]=231+n*7;image.data[k+1]=220+n*7;image.data[k+2]=211+n*7;image.data[k+3]=255;relief.data[k]=relief.data[k+1]=relief.data[k+2]=128+n*29;relief.data[k+3]=255}
  c.putImageData(image,0,0);b.putImageData(relief,0,0)
  const x=(value:number)=>(value-handData.bounds[0]!)/(handData.bounds[3]!-handData.bounds[0]!)*width,y=(value:number)=>(1-(value-handData.bounds[1]!)/(handData.bounds[4]!-handData.bounds[1]!))*height
  function crease(points:number[][],opacity=.13){for(const ctx of [c,b]){ctx.strokeStyle=ctx===c?`rgba(91,61,45,${opacity})`:'rgba(35,35,35,.33)';ctx.lineWidth=ctx===c?1.1:1.8;ctx.beginPath();ctx.moveTo(x(points[0]![0]!),y(points[0]![1]!));ctx.bezierCurveTo(x(points[1]![0]!),y(points[1]![1]!),x(points[2]![0]!),y(points[2]![1]!),x(points[3]![0]!),y(points[3]![1]!));ctx.stroke()}}
  // Shallow IP/MCP folds cross the thumb, while the thenar crease flows into the palm.
  crease([[.588,-.025],[.622,-.011],[.657,.014],[.681,.037]])
  crease([[.595,-.040],[.629,-.026],[.661,-.003],[.688,.018]],.08)
  crease([[.702,-.194],[.733,-.177],[.762,-.151],[.782,-.131]])
  crease([[.682,-.35],[.705,-.20],[.79,-.115],[.839,-.08]],.10)
  for(const dy of [0,.026])crease([[.796,-.541+dy],[.842,-.56+dy],[.894,-.555+dy],[.94,-.531+dy]],.09)
  c.strokeStyle='rgba(102,127,126,.10)';c.lineWidth=2;c.beginPath();c.moveTo(x(.93),y(-.63));c.bezierCurveTo(x(.92),y(-.36),x(.94),y(-.20),x(.905),y(-.06));c.stroke()
  const map=new THREE.CanvasTexture(color);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=2
  const bumpMap=new THREE.CanvasTexture(bump);bumpMap.anisotropy=2
  const skin=new THREE.MeshStandardMaterial({color:'#be957b',map,bumpMap,bumpScale:.0018,roughness:.68,metalness:0})
  const nail=new THREE.MeshPhysicalMaterial({color:'#cda58d',roughness:.35,clearcoat:.18,clearcoatRoughness:.32})
  return{skin,nail}
}
export class UnifiedHand{
  readonly group=new THREE.Group()
  readonly skin:THREE.SkinnedMesh
  private bones:THREE.Bone[]=[]
  constructor(side:number,material:THREE.Material,nailMaterial:THREE.Material){
    this.skin=new THREE.SkinnedMesh(handGeometry(side),material);this.skin.name=side<0?'continuous-left-hand':'continuous-right-hand';this.skin.frustumCulled=false;this.group.add(this.skin)
    const root=new THREE.Bone();this.bones.push(root);this.skin.add(root)
    for(let i=0;i<5;i++){const bone=new THREE.Bone();root.add(bone);this.bones.push(bone)}this.skin.bind(new THREE.Skeleton(this.bones))
    const nail=new THREE.Mesh(new THREE.SphereGeometry(1,18,10),nailMaterial);nail.scale.set(.030,.044,.004)
    const nx=side*.575+(side>0?.065:.015),ny=.116,probe=new THREE.Mesh(this.skin.geometry,material),ray=new THREE.Raycaster(new THREE.Vector3(nx,ny,1),new THREE.Vector3(0,0,-1)),hit=ray.intersectObject(probe,false)[0]
    nail.position.set(nx,ny,(hit?.point.z??.332)+.004);nail.rotation.set(.09,0,side*.385);this.bones[1]!.add(nail)
    const indexNail=new THREE.Mesh(new THREE.SphereGeometry(1,14,8),nailMaterial);indexNail.name='index-nail';indexNail.scale.set(.032,.023,.004)
    ray.set(new THREE.Vector3(side*.589,.381,1),new THREE.Vector3(0,0,-1));const indexHit=ray.intersectObject(probe,false)[0]
    indexNail.position.set(side*.589,.381,(indexHit?.point.z??.14)+.004);indexNail.rotation.z=side*.12;this.bones[2]!.add(indexNail)
  }
  pose(thumbX:number,thumbY:number,press:number,curls:number[]){
    this.bones[1]!.position.set(thumbX*.045,thumbY*.042,-press*.032)
    for(let i=0;i<4;i++)this.bones[i+2]!.position.set(0,(curls[i]!-.5)*.018-(i===0?press*.025:0),-(curls[i]!-.5)*.025-(i===0?press*.023:0))
  }
}
