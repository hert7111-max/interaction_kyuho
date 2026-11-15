export type Point={x:number;y:number}
export type FaceFrame={x:number;y:number;width:number;height:number;contour:Point[]}
export const PARTICLE_PALETTE=['#ff7410','#ff9a61','#f6a2e5','#ec89df','#c69cf1','#9586e8','#c5d76c'] as const
const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,value))
export function smoothstep(a:number,b:number,x:number){const t=clamp((x-a)/(b-a));return t*t*(3-2*t)}
export function insidePolygon(point:Point,polygon:Point[]){
  let inside=false
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i]!,b=polygon[j]!
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside
  }
  return inside
}
export function strokeTouchesFace(from:Point,to:Point,face:FaceFrame,aspect:number,radius=.045){
  const cx=(face.x+face.width*.5)*aspect,cy=face.y+face.height*.5,dx=(to.x-from.x)*aspect,dy=to.y-from.y
  const t=clamp(((cx-from.x*aspect)*dx+(cy-from.y)*dy)/(dx*dx+dy*dy||1))
  const x=from.x*aspect+dx*t,y=from.y+dy*t
  return Math.hypot((x-cx)/(face.width*aspect*.5+radius),(y-cy)/(face.height*.5+radius))<1.1
}
export function makeFaceFrame(contour:Point[]):FaceFrame|null{
  if(contour.length<8||contour.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)))return null
  let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity
  for(const p of contour){left=Math.min(left,p.x);right=Math.max(right,p.x);bottom=Math.min(bottom,p.y);top=Math.max(top,p.y)}
  if(right-left<.025||top-bottom<.04)return null
  return{x:left,y:bottom,width:right-left,height:top-bottom,contour}
}
function seed(index:number){const value=Math.sin(index*127.1+311.7)*43758.5453;return value-Math.floor(value)}
/** Bounded, reusable typed arrays. Coordinates are screen UVs; physics offsets use screen-height units. */
export class FaceParticles{
  readonly columns:number
  readonly rows:number
  readonly count:number
  readonly positions:Float32Array
  readonly uv:Float32Array
  readonly snapshotUV:Float32Array
  readonly alpha:Float32Array
  readonly random:Float32Array
  readonly holes:Uint8Array
  readonly velocity:Float32Array
  readonly offset:Float32Array
  readonly active:Uint8Array
  face:FaceFrame|null=null
  time=0
  start=-100
  lastTouch=-100
  burstSerial=0
  direction:Point={x:1,y:0}
  origin:Point={x:.5,y:.5}
  aspect=16/9
  private release:Float32Array
  private accumulator=0
  private bursting=false
  constructor(columns=64,rows=80){
    this.columns=columns;this.rows=rows;this.count=columns*rows
    this.positions=new Float32Array(this.count*3);this.uv=new Float32Array(this.count*2);this.snapshotUV=new Float32Array(this.count*2)
    this.alpha=new Float32Array(this.count);this.random=new Float32Array(this.count);this.holes=new Uint8Array(this.count*4)
    this.velocity=new Float32Array(this.count*2);this.offset=new Float32Array(this.count*2);this.active=new Uint8Array(this.count);this.release=new Float32Array(this.count)
    for(let i=0;i<this.count;i++){this.uv[i*2]=(i%columns+.5)/columns;this.uv[i*2+1]=(Math.floor(i/columns)+.5)/rows;this.random[i]=seed(i+1)}
  }
  get stage(){if(!this.bursting)return'idle';const age=this.time-this.start;return age<.4?'glitch':age<this.returnAt-this.start?'scattering':'returning'}
  get returnAt(){return Math.min(this.start+4.1,Math.max(this.start+2.2,this.lastTouch+1.5))}
  get glitch(){if(!this.bursting)return 0;const age=this.time-this.start;return smoothstep(0,.15,age)*(1-smoothstep(.7,2.4,age))}
  setFace(face:FaceFrame){this.face=face}
  push(from:Point,to:Point){
    if(!this.face)return false
    const dx=(to.x-from.x)*this.aspect,dy=to.y-from.y,distance=Math.hypot(dx,dy)
    if(distance<.004||!strokeTouchesFace(from,to,this.face,this.aspect))return false
    this.lastTouch=this.time
    if(!this.bursting){
      this.start=this.time;this.bursting=true;this.burstSerial++
      this.direction={x:dx/distance,y:dy/distance};this.origin={x:to.x,y:to.y}
      const face=this.face
      for(let i=0;i<this.count;i++){
        const u=this.uv[i*2]!,v=this.uv[i*2+1]!,x=face.x+u*face.width,y=face.y+v*face.height,s=this.random[i]!
        this.active[i]=Number(insidePolygon({x,y},face.contour))
        this.snapshotUV[i*2]=x;this.snapshotUV[i*2+1]=y
        this.release[i]=.34+Math.hypot((x-to.x)*this.aspect,y-to.y)*.65+s*.24
        const angle=seed(i+91)*Math.PI*2,force=.12+seed(i+7)*.5
        this.velocity[i*2]=this.direction.x*(.2+s*.65)+Math.cos(angle)*force
        this.velocity[i*2+1]=this.direction.y*(.2+s*.5)+Math.sin(angle)*force+.07
      }
      return true
    }
    // Additional moving fingers disturb the same particles; a hard deadline still guarantees recovery.
    for(let i=0;i<this.count;i+=2){this.velocity[i*2]+=dx*.6;this.velocity[i*2+1]+=dy*.6}
    return true
  }
  update(dt:number){
    dt=Math.max(0,Math.min(.06,dt));this.time+=dt
    if(!this.face)return
    if(!this.bursting)return
    this.accumulator+=dt
    while(this.accumulator>=1/120){this.integrate(1/120);this.accumulator-=1/120}
    const age=this.time-this.start,returnProgress=smoothstep(this.returnAt,this.returnAt+2.6,this.time)
    const face=this.face
    for(let i=0;i<this.count;i++){
      const j=i*2,k=i*3,u=this.uv[j]!,v=this.uv[j+1]!,departure=smoothstep(this.release[i]!,this.release[i]!+.22,age)
      const hole=this.active[i]?departure*(1-returnProgress):0
      this.positions[k]=face.x+u*face.width+this.offset[j]!/this.aspect
      this.positions[k+1]=face.y+v*face.height+this.offset[j+1]!
      this.positions[k+2]=0
      this.alpha[i]=this.active[i]?departure*(1-smoothstep(.86,1,returnProgress)):0
      this.holes[i*4]=Math.round(hole*255);this.holes[i*4+3]=255
    }
    if(this.time>this.returnAt+2.9)this.reset()
  }
  private integrate(dt:number){
    const age=this.time-this.start,returning=this.time>=this.returnAt
    for(let i=0;i<this.count;i++){
      if(!this.active[i]||age<this.release[i]!)continue
      const j=i*2,s=this.random[i]!
      if(returning){
        this.velocity[j]+=(-this.offset[j]!*22-this.velocity[j]!*8.5)*dt
        this.velocity[j+1]+=(-this.offset[j+1]!*22-this.velocity[j+1]!*8.5)*dt
      }else{
        this.velocity[j]+=(Math.sin(this.time*1.2+s*11)*.12-this.velocity[j]!*.75)*dt
        this.velocity[j+1]+=(Math.cos(this.time*1.1+s*9)*.1-this.velocity[j+1]!*.75)*dt
      }
      this.offset[j]+=this.velocity[j]!*dt;this.offset[j+1]+=this.velocity[j+1]!*dt
    }
  }
  reset(){this.bursting=false;this.start=this.lastTouch=-100;this.offset.fill(0);this.velocity.fill(0);this.alpha.fill(0);this.holes.fill(0);this.accumulator=0}
}
