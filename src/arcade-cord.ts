import * as THREE from 'three'
/** One continuous world-space cord, anchored to the moving controller and the monitor socket. */
export class ArcadeCord{
  readonly mesh:THREE.Mesh
  private knots=Array.from({length:7},()=>new THREE.Vector3())
  private curve=new THREE.CatmullRomCurve3(this.knots)
  private points=Array.from({length:49},()=>new THREE.Vector3())
  private positions=new Float32Array(49*7*3)
  private normals=new Float32Array(this.positions.length)
  private tangent=new THREE.Vector3()
  private normal=new THREE.Vector3()
  private binormal=new THREE.Vector3()
  private up=new THREE.Vector3(0,1,0)
  constructor(){
    const g=new THREE.BufferGeometry(),index:number[]=[]
    for(let j=0;j<48;j++)for(let i=0;i<6;i++){const a=j*7+i,b=a+7;index.push(a,b,a+1,b,b+1,a+1)}
    g.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('normal',new THREE.BufferAttribute(this.normals,3).setUsage(THREE.DynamicDrawUsage));g.setIndex(index)
    this.mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#1d2025',roughness:.78}));this.mesh.frustumCulled=false
  }
  update(start:THREE.Vector3,end:THREE.Vector3){
    const k=this.knots;k[0]!.copy(start);k[1]!.copy(start);k[1]!.x-=.025;k[1]!.y+=.10;k[1]!.z-=.18
    k[2]!.lerpVectors(start,end,.27);k[2]!.x-=.14;k[2]!.y+=.12
    k[3]!.lerpVectors(start,end,.55);k[3]!.x-=.28;k[3]!.y+=.08
    k[4]!.lerpVectors(start,end,.82);k[4]!.x-=.10;k[4]!.y+=.015
    k[5]!.copy(end);k[5]!.z+=.15;k[6]!.copy(end)
    for(let j=0;j<49;j++){this.curve.getPoint(j/48,this.points[j]);if(this.points[j]!.z<2.12)this.points[j]!.y=Math.max(.035,this.points[j]!.y)}
    for(let j=0;j<49;j++){
      const p=this.points[j]!;this.tangent.subVectors(this.points[Math.min(48,j+1)]!,this.points[Math.max(0,j-1)]!).normalize();this.normal.crossVectors(this.tangent,this.up).normalize();if(this.normal.lengthSq()<.01)this.normal.set(1,0,0);this.binormal.crossVectors(this.normal,this.tangent).normalize()
      for(let i=0;i<=6;i++){const a=i/6*Math.PI*2,c=Math.cos(a),s=Math.sin(a),x=this.normal.x*c+this.binormal.x*s,y=this.normal.y*c+this.binormal.y*s,z=this.normal.z*c+this.binormal.z*s,n=(j*7+i)*3;this.positions[n]=p.x+x*.018;this.positions[n+1]=p.y+y*.018;this.positions[n+2]=p.z+z*.018;this.normals[n]=x;this.normals[n+1]=y;this.normals[n+2]=z}
    }
    this.mesh.geometry.getAttribute('position').needsUpdate=true;this.mesh.geometry.getAttribute('normal').needsUpdate=true
  }
}
