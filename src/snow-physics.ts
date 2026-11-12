export type Vec = { x: number; y: number }
export interface CollisionField { distance(x:number,y:number):number; normal(x:number,y:number):Vec }
export type Snowflake = Vec & { id:number; vx:number; vy:number; radius:number; age:number; life:number; phase:number; settled:boolean }
export const GRAVITY = 165
export const STATIC_FRICTION = .72
export const DYNAMIC_FRICTION = .44

/** Impulse response: low-speed tangential motion sticks; steeper contacts slide. */
export function contactVelocity(vx:number,vy:number,nx:number,ny:number,restitution=.07):Vec {
  const vn=vx*nx+vy*ny
  if(vn>=0)return {x:vx,y:vy}
  const impulse=-(1+restitution)*vn
  vx+=impulse*nx;vy+=impulse*ny
  const tx=-ny,ty=nx,tangent=vx*tx+vy*ty
  const friction=Math.abs(tangent)<=STATIC_FRICTION*impulse?Math.abs(tangent):Math.min(Math.abs(tangent),DYNAMIC_FRICTION*impulse)
  return {x:vx-Math.sign(tangent)*friction*tx,y:vy-Math.sign(tangent)*friction*ty}
}

/** Signed distance to the live human silhouette, in a 900-unit-high world. */
export class HumanField implements CollisionField {
  width:number
  height:number
  worldWidth:number
  worldHeight:number
  mask:Uint8Array
  private signed:Float32Array
  private toSolid:Float32Array
  private toAir:Float32Array
  hasPerson=false
  constructor(worldWidth:number,worldHeight=900,height=180){
    this.height=height;this.width=Math.max(48,Math.min(480,Math.round(height*worldWidth/worldHeight)))
    this.worldWidth=worldWidth;this.worldHeight=worldHeight
    this.mask=new Uint8Array(this.width*this.height);this.signed=new Float32Array(this.mask.length)
    this.toSolid=new Float32Array(this.mask.length);this.toAir=new Float32Array(this.mask.length);this.clear()
  }
  clear(){this.mask.fill(0);this.signed.fill(10000);this.hasPerson=false}
  update(probability:Float32Array,mw:number,mh:number,videoAspect:number,mirror=true){
    const aspect=this.worldWidth/this.worldHeight,sx=Math.min(1,aspect/videoAspect),sy=Math.min(1,videoAspect/aspect)
    let occupied=0
    for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
      let u=((x+.5)/this.width-.5)*sx+.5
      if(mirror)u=1-u
      const v=((y+.5)/this.height-.5)*sy+.5
      const index=y*this.width+x,value=probability[Math.min(mh-1,Math.floor(v*mh))*mw+Math.min(mw-1,Math.floor(u*mw))]??0
      // Hysteresis suppresses contour shimmer without holding a vanished body in place.
      const solid=value>(this.mask[index] ? .43 : .57)
      this.mask[index]=Number(solid);occupied+=Number(solid)
    }
    this.hasPerson=occupied>this.mask.length*.008
    this.rebuild()
  }
  setMask(mask:Uint8Array){if(mask.length!==this.mask.length)throw new Error('Mask size mismatch');this.mask.set(mask);this.hasPerson=mask.some(Boolean);this.rebuild()}
  private rebuild(){
    for(let i=0;i<this.mask.length;i++){this.toSolid[i]=this.mask[i]?0:10000;this.toAir[i]=this.mask[i]?10000:0}
    this.transform(this.toSolid);this.transform(this.toAir)
    for(let i=0;i<this.mask.length;i++)this.signed[i]=this.toSolid[i]!-this.toAir[i]!
  }
  private transform(d:Float32Array){
    const w=this.width,h=this.height,dx=this.worldWidth/w,dy=this.worldHeight/h,diagonal=Math.hypot(dx,dy)
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x;let value=d[i]!
      if(x)value=Math.min(value,d[i-1]!+dx)
      if(y){value=Math.min(value,d[i-w]!+dy);if(x)value=Math.min(value,d[i-w-1]!+diagonal);if(x+1<w)value=Math.min(value,d[i-w+1]!+diagonal)}
      d[i]=value
    }
    for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){
      const i=y*w+x;let value=d[i]!
      if(x+1<w)value=Math.min(value,d[i+1]!+dx)
      if(y+1<h){value=Math.min(value,d[i+w]!+dy);if(x)value=Math.min(value,d[i+w-1]!+diagonal);if(x+1<w)value=Math.min(value,d[i+w+1]!+diagonal)}
      d[i]=value
    }
  }
  distance(x:number,y:number){
    if(x<0||x>=this.worldWidth||y<0||y>=this.worldHeight)return 10000
    const gx=Math.max(0,Math.min(this.width-1.001,x/this.worldWidth*this.width-.5)),gy=Math.max(0,Math.min(this.height-1.001,y/this.worldHeight*this.height-.5))
    const ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,i=iy*this.width+ix
    const a=this.signed[i]!*(1-fx)+this.signed[i+1]!*fx,b=this.signed[i+this.width]!*(1-fx)+this.signed[i+this.width+1]!*fx
    return a*(1-fy)+b*fy
  }
  normal(x:number,y:number):Vec{
    const delta=this.worldHeight/this.height
    const nx=this.distance(x+delta,y)-this.distance(x-delta,y),ny=this.distance(x,y+delta)-this.distance(x,y-delta),length=Math.hypot(nx,ny)
    return length>.0001?{x:nx/length,y:ny/length}:{x:0,y:-1}
  }
}

export class SnowWorld {
  particles:Snowflake[]=[]
  width:number
  height:number
  wind=0
  private accumulator=0
  private serial=0
  private time=0
  private random:()=>number
  private grid=new Map<number,Snowflake[]>()
  constructor(width:number,height=900,random:()=>number=Math.random){this.width=width;this.height=height;this.random=random}
  clear(){this.particles=[];this.grid.clear();this.accumulator=0}
  spawn(x:number,y:number,spread:number,count=1){
    for(let i=0;i<count&&this.particles.length<1800;i++){
      const random=this.random
      this.particles.push({id:++this.serial,x:x+(random()-.5)*spread,y:y+random()*8,vx:(random()-.5)*14,vy:8+random()*15,radius:1.5+random()*2.1,age:0,life:35+random()*20,phase:random()*Math.PI*2,settled:false})
    }
  }
  update(dt:number,field:CollisionField){
    this.accumulator+=Math.min(dt,.08)
    this.particles.sort((a,b)=>b.y-a.y)
    while(this.accumulator>=1/120){this.step(1/120,field);this.accumulator-=1/120}
    this.particles=this.particles.filter(p=>p.y<this.height+20&&p.x>-60&&p.x<this.width+60&&p.age<p.life)
  }
  private step(dt:number,field:CollisionField){
    this.time+=dt;this.grid.clear()
    const columns=Math.ceil(this.width/10)+10
    const key=(x:number,y:number)=>Math.floor(y/10)*columns+Math.floor(x/10)+5
    for(const p of this.particles)if(p.settled){const k=key(p.x,p.y);const list=this.grid.get(k);if(list)list.push(p);else this.grid.set(k,[p])}
    for(const p of this.particles){
      p.age+=dt
      const wasSettled=p.settled;p.settled=false
      const drag=wasSettled?0:1.6
      const flutter=wasSettled?0:Math.sin(this.time*1.8+p.phase)*13
      p.vx+=(this.wind*28+flutter-p.vx*drag)*dt
      p.vy+=(GRAVITY-p.vy*drag*(.65+p.radius*.18))*dt
      const fromX=p.x,fromY=p.y,targetX=p.x+p.vx*dt,targetY=p.y+p.vy*dt
      // Sweep the whole travel segment, so even unusually fast flakes cannot tunnel through a thin mask.
      const samples=Math.min(48,Math.max(1,Math.ceil(Math.hypot(targetX-fromX,targetY-fromY)/Math.max(1,p.radius))))
      p.x=targetX;p.y=targetY
      let contact=false
      for(let sample=1;sample<=samples;sample++){
        const x=fromX+(targetX-fromX)*sample/samples,y=fromY+(targetY-fromY)*sample/samples,distance=field.distance(x,y)
        if(distance<p.radius+.08){
          const n=field.normal(x,y),depth=Math.min(45,p.radius-distance+.03)
          p.x=x+n.x*depth;p.y=y+n.y*depth
          const velocity=contactVelocity(p.vx,p.vy,n.x,n.y)
          p.vx=velocity.x;p.vy=velocity.y
          contact=n.y<-.18
          break
        }
      }
      // Resting snow supports later flakes. Bottom-up solving releases the pile when its support moves away.
      const k=key(p.x,p.y)
      for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)for(const q of this.grid.get(k+yy*columns+xx)??[]){
        if(q.id===p.id||!q.settled)continue
        const dx=p.x-q.x,dy=p.y-q.y,r=p.radius+q.radius,d=Math.hypot(dx,dy)
        if(d<r+.08&&dy<.3){
          const nx=d>.001?dx/d:0,ny=d>.001?dy/d:-1,depth=r-d+.02
          p.x+=nx*depth;p.y+=ny*depth
          const v=contactVelocity(p.vx,p.vy,nx,ny,.025);p.vx=v.x;p.vy=v.y
          if(ny<-.2)contact=true
        }
      }
      if(contact&&Math.hypot(p.vx,p.vy)<7){
        p.settled=true;p.vx=0;p.vy=0
        if(!wasSettled){const k=key(p.x,p.y),list=this.grid.get(k);if(list)list.push(p);else this.grid.set(k,[p])}
      }
    }
  }
}

export class FogField {
  width:number
  height:number
  density:Float32Array
  private wiped:Float32Array
  constructor(aspect:number,height=160){this.height=height;this.width=Math.max(48,Math.min(480,Math.round(height*aspect)));this.density=new Float32Array(this.width*height);this.wiped=new Float32Array(this.density.length)}
  clear(){this.density.fill(0);this.wiped.fill(0)}
  decay(dt:number){const fade=Math.exp(-dt/13),dry=Math.exp(-dt/5);for(let i=0;i<this.density.length;i++){this.density[i]*=fade;this.wiped[i]*=dry}}
  breathe(x:number,y:number,rx:number,ry:number,amount:number){
    const cx=x*this.width,cy=y*this.height,wx=rx*this.width,wy=ry*this.height
    for(let yy=Math.max(0,Math.floor(cy-wy));yy<Math.min(this.height,cy+wy);yy++)for(let xx=Math.max(0,Math.floor(cx-wx));xx<Math.min(this.width,cx+wx);xx++){
      const d=Math.hypot((xx-cx)/wx,(yy-cy)/wy)
      if(d>=1)continue
      const index=yy*this.width+xx,weight=(1-d*d)**2
      this.density[index]=Math.min(.94,this.density[index]!+(1-this.density[index]!)*weight*amount*(1-this.wiped[index]!))
    }
  }
  erase(from:Vec,to:Vec,radius:number){
    const aspect=this.width/this.height,ax=from.x*aspect,ay=from.y,bx=to.x*aspect,by=to.y,dx=bx-ax,dy=by-ay
    const minX=Math.max(0,Math.floor((Math.min(ax,bx)-radius)/aspect*this.width)),maxX=Math.min(this.width-1,Math.ceil((Math.max(ax,bx)+radius)/aspect*this.width))
    const minY=Math.max(0,Math.floor((Math.min(ay,by)-radius)*this.height)),maxY=Math.min(this.height-1,Math.ceil((Math.max(ay,by)+radius)*this.height))
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const px=x/this.width*aspect,py=y/this.height,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)))
      const distance=Math.hypot(px-ax-t*dx,py-ay-t*dy)/radius
      if(distance>=1)continue
      const erase=1-Math.max(0,(distance-.65)/.35),i=y*this.width+x
      this.density[i]*=1-erase;this.wiped[i]=Math.max(this.wiped[i]!,erase)
    }
  }
}

export function isMouthOpen(gap:number,width:number,jaw:number,previous=false){
  const ratio=gap/Math.max(.0001,width)
  return previous?(ratio>.095||jaw>.13):(ratio>.16||jaw>.27)
}
