import {pinchPose} from './particle-engine.ts'
import type {Point} from './particle-engine.ts'
export type {Point}
export { FACE_OVAL } from './face-oval.ts'
type Handle={anchor:Point;offset:Point;target:Point;velocity:Point;held:boolean}
/** Smooth compact-support flow: each small step is injective, including long pulls. */
export function flow(point:Point,anchor:Point,offset:Point,aspect:number):Point{
  let x=point.x,y=point.y
  const radius=.48,length=Math.hypot(offset.x*aspect,offset.y),steps=Math.max(1,Math.ceil(length/(radius*.10))),dx=offset.x/steps,dy=offset.y/steps
  for(let s=0;s<steps;s++){
    const d=Math.hypot((x-anchor.x-dx*s)*aspect,y-anchor.y-dy*s)/radius
    if(d>=1)continue
    const weight=(1-d)**4*(1+4*d) // Wendland C2: round shoulders, no hard influence boundary.
    x+=dx*weight;y+=dy*weight
  }
  return{x,y}
}
export class RubberFace{
  readonly handles=new Map<string,Handle>()
  private closed=new Map<string,boolean>()
  aspect=1
  private operations:{x:number;y:number;dx:number;dy:number;radius:number}[]=[]
  deform(point:Point){
    let x=point.x,y=point.y
    for(const op of this.operations){
      const d=Math.hypot((x-op.x)*this.aspect,y-op.y)/op.radius
      if(d>=1)continue
      const w=1-d,weight=w*w*w*w*(1+4*d)
      x+=op.dx*weight;y+=op.dy*weight
    }
    return{x,y}
  }
  /** Advance both handles along their paths, with disjoint pin cores so neither steals the other. */
  private prepare(){
    this.operations.length=0
    const handles=[...this.handles.values()]
    if(!handles.length)return
    const separation=(t:number)=>handles.length<2?Infinity:Math.hypot((handles[0]!.anchor.x+handles[0]!.offset.x*t-handles[1]!.anchor.x-handles[1]!.offset.x*t)*this.aspect,handles[0]!.anchor.y+handles[0]!.offset.y*t-handles[1]!.anchor.y-handles[1]!.offset.y*t)
    let minRadius=.48
    for(let i=0;i<=32;i++)minRadius=Math.min(minRadius,Math.max(.015,separation(i/32)*.7))
    const length=Math.max(...handles.map(h=>Math.hypot(h.offset.x*this.aspect,h.offset.y)))
    const steps=Math.max(1,Math.ceil(length/(minRadius*.08)))
    for(let s=0;s<steps;s++){
      const radius=Math.min(.48,Math.max(.015,separation(s/steps)*.7))
      for(const h of handles)this.operations.push({x:h.anchor.x+h.offset.x*s/steps,y:h.anchor.y+h.offset.y*s/steps,dx:h.offset.x/steps,dy:h.offset.y/steps,radius})
    }
  }
  hand(id:string,hand:Point[],hit:(p:Point)=>Point|null){
    const was=this.closed.get(id)??false,pose=pinchPose(hand,was,this.aspect)
    if(!pose){this.release(id);this.closed.delete(id);return}
    if(pose.closed){
      if(!was){const anchor=hit(pose.point);if(anchor&&(this.handles.has(id)||this.handles.size<2))this.handles.set(id,{anchor,offset:{x:pose.point.x-anchor.x,y:pose.point.y-anchor.y},target:pose.point,velocity:{x:0,y:0},held:true})}
      else{const h=this.handles.get(id);if(h?.held){if(Math.hypot((pose.point.x-h.target.x)*this.aspect,pose.point.y-h.target.y)>.9)this.release(id);else h.target=pose.point}}
    }else this.release(id)
    this.closed.set(id,pose.closed)
  }
  release(id:string){const h=this.handles.get(id);if(h)h.held=false}
  retain(seen:Set<string>){for(const id of this.closed.keys())if(!seen.has(id)){this.release(id);this.closed.delete(id)}}
  releaseAll(){for(const id of this.handles.keys())this.release(id);this.closed.clear()}
  update(dt:number){
    const steps=Math.max(1,Math.ceil(Math.min(dt,.06)*120)),step=Math.min(dt,.06)/steps
    for(const [id,h] of this.handles){
      for(let n=0;n<steps;n++)for(const axis of ['x','y'] as const){
        const target=h.held?h.target[axis]-h.anchor[axis]:0
        if(h.held){h.offset[axis]+=(target-h.offset[axis])*(1-Math.exp(-42*step));h.velocity[axis]=0}
        else{h.velocity[axis]+=(-170*h.offset[axis]-15*h.velocity[axis])*step;h.offset[axis]+=h.velocity[axis]*step}
      }
      if(!h.held&&Math.hypot(h.offset.x,h.offset.y)<.0001&&Math.hypot(h.velocity.x,h.velocity.y)<.001)this.handles.delete(id)
    }
    this.prepare()
  }
  reset(){this.handles.clear();this.closed.clear();this.operations.length=0}
}
/** Barycentric picking finds the original texture coordinate even on stretched skin. */
export function pickTriangle(p:Point,a:Point,b:Point,c:Point){
  const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y)
  if(Math.abs(det)<1e-10)return null
  const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/det,v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/det
  return u>=-1e-6&&v>=-1e-6&&u+v<=1.000001?[u,v,1-u-v]:null
}
