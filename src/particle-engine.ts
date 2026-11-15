export type Point={x:number;y:number}
export const GLITCH_RADIUS_SCALE=4
export const GLITCH_GLYPHS='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZx'
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v))
/** Four times the previous measured fingertip radius, in screen-height units. */
export function fingertipRadius(tip:Point,joint:Point,aspect:number,screenHeight:number){
  const bone=Math.hypot((tip.x-joint.x)*aspect,tip.y-joint.y)
  return clamp(Number.isFinite(bone)?bone*.34:.01,5/screenHeight,17/screenHeight)*GLITCH_RADIUS_SCALE
}
/** Screen-space corruption field: hands work with no face visible, over any camera pixel. */
export class FingertipDatamosh{
  readonly columns:number
  readonly rows:number
  readonly field:Uint8Array
  readonly energy:Float32Array
  private touched:Float32Array
  version=0
  aspect=16/9
  time=0
  lastTouch=-100
  activeCount=0
  constructor(columns=192,rows=192){
    this.columns=columns;this.rows=rows
    this.field=new Uint8Array(columns*rows*4);this.energy=new Float32Array(columns*rows);this.touched=new Float32Array(columns*rows)
  }
  get stage(){return this.activeCount===0?'idle':this.time-this.lastTouch<.18?'glitch':'recovering'}
  touch(point:Point,previous:Point|null,radius:number){
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!(radius>0)||!Number.isFinite(radius))return false
    let from=previous??point
    let dx=(point.x-from.x)*this.aspect,dy=point.y-from.y,length=Math.hypot(dx,dy)
    // Do not bridge tracking jumps or newly reacquired hands across the image.
    if(length>.28||!Number.isFinite(length)){from=point;dx=dy=length=0}
    radius=Math.min(radius,.18)
    const rx=radius/this.aspect,ry=radius
    const x0=clamp(Math.floor((Math.min(from.x,point.x)-rx)*this.columns),0,this.columns-1)
    const x1=clamp(Math.ceil((Math.max(from.x,point.x)+rx)*this.columns),0,this.columns-1)
    const y0=clamp(Math.floor((Math.min(from.y,point.y)-ry)*this.rows),0,this.rows-1)
    const y1=clamp(Math.ceil((Math.max(from.y,point.y)+ry)*this.rows),0,this.rows-1)
    let changed=false
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const px=(x+.5)/this.columns,py=(y+.5)/this.rows
      const t=length?clamp(((px-from.x)*this.aspect*dx+(py-from.y)*dy)/(length*length)):0
      const d=Math.hypot((px-from.x-dx/this.aspect*t)*this.aspect,py-from.y-dy*t)/radius
      if(d>=1)continue
      const strength=1-clamp((d-.78)/.22),i=y*this.columns+x,k=i*4
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
    const x=Math.floor(point.x*this.columns),y=Math.floor(point.y*this.rows)
    return x<0||x>=this.columns||y<0||y>=this.rows?0:this.energy[y*this.columns+x]!
  }
  update(dt:number){
    dt=clamp(dt,0,.06);this.time+=dt
    if(!this.activeCount)return
    let changed=false
    for(let i=0;i<this.energy.length;i++){
      if(this.energy[i]===0||this.time-this.touched[i]!<.16)continue
      this.energy[i]=Math.max(0,this.energy[i]!-dt/1.6)
      const value=Math.round(this.energy[i]!*255)
      if(value!==this.field[i*4]){this.field[i*4]=value;changed=true}
      if(this.energy[i]===0){this.field.fill(0,i*4,i*4+4);this.activeCount--}
    }
    if(changed)this.version++
  }
  reset(){this.field.fill(0);this.energy.fill(0);this.activeCount=0;this.lastTouch=-100;this.version++}
}
