export type Point={x:number;y:number}
export type FaceFrame={x:number;y:number;width:number;height:number;contour:Point[]}
export const GLITCH_PALETTE=['#f51b9c','#25dce8','#ffd326','#7843aa','#870c35','#619610'] as const
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v))
export function insidePolygon(point:Point,polygon:Point[]){
  let inside=false
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i]!,b=polygon[j]!
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside
  }
  return inside
}
export function makeFaceFrame(contour:Point[]):FaceFrame|null{
  if(contour.length<8||contour.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null
  let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity
  for(const p of contour){left=Math.min(left,p.x);right=Math.max(right,p.x);bottom=Math.min(bottom,p.y);top=Math.max(top,p.y)}
  if(right-left<.025||top-bottom<.04)return null
  return{x:left,y:bottom,width:right-left,height:top-bottom,contour}
}
/** Radius in screen-height units, estimated from the last finger bone, never the whole hand. */
export function fingertipRadius(tip:Point,joint:Point,face:FaceFrame,aspect:number,screenHeight:number){
  const bone=Math.hypot((tip.x-joint.x)*aspect,tip.y-joint.y)
  return clamp(Number.isFinite(bone)?bone*.34:.01,Math.min(5/screenHeight,face.height*.025),Math.min(17/screenHeight,face.height*.047))
}
/** A face-local contact field. Nothing outside a fingertip's swept disc is ever activated. */
export class FingertipDatamosh{
  readonly columns:number
  readonly rows:number
  readonly field:Uint8Array
  readonly energy:Float32Array
  private touched:Float32Array
  face:FaceFrame|null=null
  faceVersion=0
  version=0
  aspect=16/9
  time=0
  lastTouch=-100
  activeCount=0
  constructor(columns=128,rows=160){
    this.columns=columns;this.rows=rows
    this.field=new Uint8Array(columns*rows*4);this.energy=new Float32Array(columns*rows);this.touched=new Float32Array(columns*rows)
  }
  get stage(){return this.activeCount===0?'idle':this.time-this.lastTouch<.16?'glitch':'recovering'}
  setFace(face:FaceFrame){this.face=face;this.faceVersion++}
  touch(point:Point,previous:Point|null,radius:number){
    const face=this.face
    if(!face||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!(radius>0))return false
    let from=previous??point
    let dx=(point.x-from.x)*this.aspect,dy=point.y-from.y,length=Math.hypot(dx,dy)
    // Reacquired hands and tracking jumps stamp only the current tip, without a connecting streak.
    if(length>.13||!Number.isFinite(length)){from=point;dx=dy=length=0}
    radius=Math.min(radius,face.height*.05)
    const rx=radius/this.aspect,ry=radius
    const x0=clamp(Math.floor((Math.min(from.x,point.x)-rx-face.x)/face.width*this.columns),0,this.columns-1)
    const x1=clamp(Math.ceil((Math.max(from.x,point.x)+rx-face.x)/face.width*this.columns),0,this.columns-1)
    const y0=clamp(Math.floor((Math.min(from.y,point.y)-ry-face.y)/face.height*this.rows),0,this.rows-1)
    const y1=clamp(Math.ceil((Math.max(from.y,point.y)+ry-face.y)/face.height*this.rows),0,this.rows-1)
    let changed=false
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const p={x:face.x+(x+.5)/this.columns*face.width,y:face.y+(y+.5)/this.rows*face.height}
      const t=length?clamp(((p.x-from.x)*this.aspect*dx+(p.y-from.y)*dy)/(length*length)):0
      const center={x:from.x+dx/this.aspect*t,y:from.y+dy*t}
      const d=Math.hypot((p.x-center.x)*this.aspect,p.y-center.y)/radius
      if(d>=1||!insidePolygon(center,face.contour)||!insidePolygon(p,face.contour))continue
      const strength=1-clamp((d-.60)/.40),i=y*this.columns+x,k=i*4
      if(this.energy[i]===0)this.activeCount++
      this.energy[i]=Math.max(this.energy[i]!,strength);this.touched[i]=this.time
      this.field[k]=Math.round(this.energy[i]!*255)
      this.field[k+1]=Math.round((length?dx/length:0)*100+128)
      this.field[k+2]=Math.round((length?dy/length:0)*100+128)
      this.field[k+3]=255;changed=true
    }
    if(changed){this.lastTouch=this.time;this.version++}
    return changed
  }
  sample(point:Point){
    const face=this.face;if(!face||!insidePolygon(point,face.contour))return 0
    const x=Math.floor((point.x-face.x)/face.width*this.columns),y=Math.floor((point.y-face.y)/face.height*this.rows)
    return x<0||x>=this.columns||y<0||y>=this.rows?0:this.energy[y*this.columns+x]!
  }
  update(dt:number){
    dt=clamp(dt,0,.06);this.time+=dt
    if(!this.activeCount)return
    let changed=false
    for(let i=0;i<this.energy.length;i++){
      if(this.energy[i]===0||this.time-this.touched[i]!<.12)continue
      this.energy[i]=Math.max(0,this.energy[i]!-dt/1.12)
      const value=Math.round(this.energy[i]!*255)
      if(value!==this.field[i*4]){this.field[i*4]=value;changed=true}
      if(this.energy[i]===0){this.field.fill(0,i*4,i*4+4);this.activeCount--}
    }
    if(changed)this.version++
  }
  reset(){this.field.fill(0);this.energy.fill(0);this.activeCount=0;this.lastTouch=-100;this.version++}
}
