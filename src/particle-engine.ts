export type Point={x:number;y:number}
export type Grip={point:Point;target:Point;radius:number}
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n))
const valid=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y)
export const RUBBER_RECOVERY_SECONDS=16
/** Palm-relative pinch with hysteresis; mirrored, cover-corrected screen coordinates. */
export function pinchPose(hand:Point[],wasClosed:boolean,aspect:number){
  if([0,4,5,8,9,17].some(i=>!hand[i]||!valid(hand[i]!)))return null
  const distance=(a:Point,b:Point)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y)
  const palm=Math.max(distance(hand[5]!,hand[17]!),distance(hand[0]!,hand[9]!)*.8)
  if(palm<.018)return null
  const thumb=hand[4]!,index=hand[8]!,ratio=distance(thumb,index)/palm
  return{point:{x:(thumb.x+index.x)*.5,y:(thumb.y+index.y)*.5},closed:ratio<(wasClosed ? .44 : .28),radius:clamp(palm*.95,.105,.24)}
}
/** Inverse material coordinates, advected by small, smooth, non-folding local pulls. */
export class RubberSurface{
  readonly columns:number
  readonly rows:number
  readonly coordinates:Float32Array
  readonly field:Uint8Array
  readonly grips=new Map<string,Grip>()
  private work:Float32Array
  private recoveryFrom:Float32Array
  private returning=false
  private returnTime=0
  private changed=false
  version=0
  aspect=16/9
  deformed=false
  constructor(columns=192,rows=192){
    this.columns=columns;this.rows=rows
    this.coordinates=new Float32Array(columns*rows*2);this.work=new Float32Array(this.coordinates.length);this.recoveryFrom=new Float32Array(this.coordinates.length)
    this.field=new Uint8Array(columns*rows*4);this.reset()
  }
  get stage(){return this.grips.size?'holding':this.deformed?'returning':'idle'}
  grab(id:string,point:Point,radius=.15){
    if(!valid(point)||!Number.isFinite(radius)||this.grips.size>=2&&!this.grips.has(id))return false
    const p={x:clamp(point.x),y:clamp(point.y)}
    this.grips.set(id,{point:{...p},target:{...p},radius:clamp(radius,.08,.28)})
    this.returning=false;return true
  }
  move(id:string,point:Point){
    const grip=this.grips.get(id);if(!grip||!valid(point))return false
    const next={x:clamp(point.x),y:clamp(point.y)}
    if(Math.hypot((next.x-grip.target.x)*this.aspect,next.y-grip.target.y)>.45){this.release(id);return false}
    grip.target=next;return true
  }
  release(id:string){
    const grip=this.grips.get(id);if(!grip)return
    this.pull(grip.point,grip.target,grip.radius);this.grips.delete(id)
    if(!this.grips.size&&this.deformed){this.recoveryFrom.set(this.coordinates);this.returnTime=0;this.returning=true}
    if(this.changed)this.encode()
  }
  releaseAll(){for(const id of this.grips.keys())this.release(id)}
  /** Bilinear source lookup; a re-grab picks up the already stretched material. */
  sourceAt(point:Point):Point{
    const x=clamp(point.x)*(this.columns-1),y=clamp(point.y)*(this.rows-1),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,this.columns-1),y1=Math.min(y0+1,this.rows-1),a=x-x0,b=y-y0
    const i=(y0*this.columns+x0)*2,j=(y0*this.columns+x1)*2,k=(y1*this.columns+x0)*2,l=(y1*this.columns+x1)*2,m=this.coordinates
    return{x:(m[i]!*(1-a)+m[j]!*a)*(1-b)+(m[k]!*(1-a)+m[l]!*a)*b,y:(m[i+1]!*(1-a)+m[j+1]!*a)*(1-b)+(m[k+1]!*(1-a)+m[l+1]!*a)*b}
  }
  private pull(from:Point,to:Point,radius:number){
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx*this.aspect,dy)
    if(length<.000005)return
    const steps=Math.max(1,Math.ceil(length/(radius*.12))),sx=dx/steps,sy=dy/steps
    for(let step=1;step<=steps;step++)this.advect(from.x+sx*step,from.y+sy*step,sx,sy,radius)
    this.deformed=this.changed=true
  }
  private advect(cx:number,cy:number,dx:number,dy:number,radius:number){
    const cols=this.columns,rows=this.rows,m=this.coordinates,w=this.work
    const left=Math.max(0,Math.floor((cx-radius/this.aspect)*(cols-1))),right=Math.min(cols-1,Math.ceil((cx+radius/this.aspect)*(cols-1)))
    const bottom=Math.max(0,Math.floor((cy-radius)*(rows-1))),top=Math.min(rows-1,Math.ceil((cy+radius)*(rows-1)))
    for(let y=bottom;y<=top;y++)for(let x=left;x<=right;x++){
      const px=x/(cols-1),py=y/(rows-1),distance=Math.hypot((px-cx)*this.aspect,py-cy)/radius,i=(y*cols+x)*2
      let weight=0
      if(distance<1){const t=clamp((distance-.30)/.70);weight=1-t*t*(3-2*t)}
      const gx=clamp(px-dx*weight)*(cols-1),gy=clamp(py-dy*weight)*(rows-1),x0=Math.floor(gx),y0=Math.floor(gy),x1=Math.min(x0+1,cols-1),y1=Math.min(y0+1,rows-1),a=gx-x0,b=gy-y0
      const p=(y0*cols+x0)*2,q=(y0*cols+x1)*2,r=(y1*cols+x0)*2,s=(y1*cols+x1)*2
      w[i]=(m[p]!*(1-a)+m[q]!*a)*(1-b)+(m[r]!*(1-a)+m[s]!*a)*b
      w[i+1]=(m[p+1]!*(1-a)+m[q+1]!*a)*(1-b)+(m[r+1]!*(1-a)+m[s+1]!*a)*b
    }
    for(let y=bottom;y<=top;y++)for(let i=(y*cols+left)*2,end=(y*cols+right+1)*2;i<end;i++)m[i]=w[i]!
  }
  update(dt:number){
    dt=clamp(dt,0,.06)
    if(this.grips.size){
      const alpha=1-Math.exp(-36*dt)
      for(const grip of this.grips.values()){
        const next={x:grip.point.x+(grip.target.x-grip.point.x)*alpha,y:grip.point.y+(grip.target.y-grip.point.y)*alpha}
        this.pull(grip.point,next,grip.radius);grip.point=next
      }
    }else if(this.returning){
      this.returnTime+=dt
      const t=clamp(this.returnTime/RUBBER_RECOVERY_SECONDS),ease=t*t*(3-2*t),rest=1-ease
      for(let y=0;y<this.rows;y++)for(let x=0;x<this.columns;x++){
        const i=(y*this.columns+x)*2,u=x/(this.columns-1),v=y/(this.rows-1)
        this.coordinates[i]=u+(this.recoveryFrom[i]!-u)*rest;this.coordinates[i+1]=v+(this.recoveryFrom[i+1]!-v)*rest
      }
      this.changed=true
      if(t>=1){this.returning=this.deformed=false}
    }
    if(this.changed)this.encode()
  }
  private encode(){
    for(let i=0;i<this.coordinates.length;i+=2){
      const x=Math.round(clamp(this.coordinates[i]!)*65535),y=Math.round(clamp(this.coordinates[i+1]!)*65535),k=i*2
      this.field[k]=x>>>8;this.field[k+1]=x&255;this.field[k+2]=y>>>8;this.field[k+3]=y&255
    }
    this.changed=false;this.version++
  }
  reset(){
    this.grips.clear();this.returning=this.deformed=false;this.returnTime=0
    for(let y=0;y<this.rows;y++)for(let x=0;x<this.columns;x++){const i=(y*this.columns+x)*2;this.coordinates[i]=x/(this.columns-1);this.coordinates[i+1]=y/(this.rows-1)}
    this.encode()
  }
}
/** Keeps both hands separate; opening a pinch, occlusion and stale data release the material. */
export class PinchInput{
  private states=new Map<string,{closed:boolean;time:number}>()
  readonly surface:RubberSurface
  constructor(surface:RubberSurface){this.surface=surface}
  hand(id:string,landmarks:Point[],now:number){
    let state=this.states.get(id)
    if(state&&now-state.time>260){this.surface.release(id);state=undefined}
    const pose=pinchPose(landmarks,state?.closed??false,this.surface.aspect)
    if(!pose){this.surface.release(id);this.states.delete(id);return}
    if(pose.closed){
      if(!state?.closed)this.surface.grab(id,pose.point,pose.radius)
      else this.surface.move(id,pose.point)
    }else this.surface.release(id)
    this.states.set(id,{closed:pose.closed,time:now})
  }
  retain(seen:Set<string>){for(const id of this.states.keys())if(!seen.has(id)){this.surface.release(id);this.states.delete(id)}}
  releaseAll(){this.surface.releaseAll();this.states.clear()}
}
