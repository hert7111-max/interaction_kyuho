import {isPointing} from './papa-game.ts'
import type {Landmark} from './papa-game.ts'
export type Point={x:number;y:number}
export type ArcadeHand={id:string;tip:Point;direction:Point;firing:boolean;curls:number[];thumb:Point;activity:number}
export type Jet={id:number;x:number;y:number;speed:number;variant:number;scale:number;phase:number;state:'flying'|'falling';vx:number;vy:number;angle:number;age:number;smoke:number}
export type Bullet={x:number;y:number;px:number;py:number;vx:number;vy:number;age:number;side:string}
export type Debris={x:number;y:number;vx:number;vy:number;age:number;life:number;size:number;kind:'spark'|'smoke';color:string}
export const JET_VARIANTS=8
export const JET_COLORS=['#76b4c8','#88924f','#d34e53','#69cbc6','#d1a65c','#a57ac4','#a9b8b7','#5473ab'] as const
export const MAX_JETS=15,MAX_BULLETS=90,MAX_DEBRIS=300
export function fingerCurl(hand:Landmark[],base:number,aspect=1){
  const a=hand[base],b=hand[base+1],c=hand[base+3];if(!a||!b||!c)return 0
  const x=(a.x-b.x)*aspect,y=a.y-b.y,z=((a.z??0)-(b.z??0))*aspect,u=(c.x-b.x)*aspect,v=c.y-b.y,w=((c.z??0)-(b.z??0))*aspect
  const cosine=(x*u+y*v+z*w)/(Math.hypot(x,y,z)*Math.hypot(u,v,w)||1)
  return Math.max(0,Math.min(1,(cosine+.88)/1.4))
}
export function isFingerGun(hand:Landmark[],aspect=1){
  if(hand.length<21||hand.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||!isPointing(hand,aspect))return false
  const distance=(a:number,b:number)=>Math.hypot((hand[a]!.x-hand[b]!.x)*aspect,hand[a]!.y-hand[b]!.y,((hand[a]!.z??0)-(hand[b]!.z??0))*aspect)
  const folded=[9,13,17].filter(base=>fingerCurl(hand,base,aspect)>.36||distance(base+3,0)<distance(base+1,0)*1.12).length
  const palm=distance(5,17)
  const thumb=distance(4,2)>distance(3,2)*1.08&&distance(4,5)>palm*.3
  return thumb&&folded>=2
}
function segmentDistance(x:number,y:number,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-dx*t,y-a.y-dy*t)}
export class ArcadeGame{
  readonly width=640
  readonly height=480
  jets:Jet[]=[]
  bullets:Bullet[]=[]
  debris:Debris[]=[]
  hands:ArcadeHand[]=[]
  muzzles:{x:number;y:number;age:number;side:string}[]=[]
  time=0
  score=0
  kills=0
  rounds=0
  flash=0
  recoil=0
  private serial=0
  private variant=0
  private spawnClock=0
  private cooldowns=new Map<string,number>()
  private jetPool:Jet[]=[]
  private bulletPool:Bullet[]=[]
  private debrisPool:Debris[]=[]
  private random:()=>number
  constructor(random:()=>number=Math.random){this.random=random;this.reset()}
  get firing(){return this.hands.some(h=>h.firing)}
  reset(){
    this.jetPool.push(...this.jets);this.bulletPool.push(...this.bullets);this.debrisPool.push(...this.debris)
    this.jets.length=this.bullets.length=this.debris.length=this.muzzles.length=0;this.hands=[];this.cooldowns.clear();this.score=this.kills=this.rounds=this.time=this.flash=this.recoil=0;this.variant=0;this.spawnClock=.8
    for(let i=0;i<5;i++)this.spawn(80+i*76)
  }
  spawn(y=530){
    if(this.jets.length>=MAX_JETS)return
    const jet=this.jetPool.pop()??{} as Jet,r=this.random
    Object.assign(jet,{id:++this.serial,x:42+r()*556,y,speed:38+r()*34,variant:this.variant++%JET_VARIANTS,scale:.65+r()*.3,phase:r()*6.28,state:'flying',vx:0,vy:0,angle:0,age:0,smoke:0});this.jets.push(jet)
  }
  update(dt:number,hands:ArcadeHand[]){
    dt=Math.max(0,Math.min(.06,dt));this.time+=dt;this.hands=hands;this.flash=Math.max(0,this.flash-dt*7);this.recoil*=Math.exp(-dt*24)
    const present=new Set<string>()
    for(const hand of hands){
      present.add(hand.id)
      if(!hand.firing){this.cooldowns.delete(hand.id);continue}
      let cooldown=(this.cooldowns.get(hand.id)??0)-dt
      while(cooldown<=0){this.fire(hand);cooldown+=1/12}
      this.cooldowns.set(hand.id,cooldown)
    }
    for(const id of this.cooldowns.keys())if(!present.has(id))this.cooldowns.delete(id)
    this.spawnClock-=dt;if(this.spawnClock<=0){this.spawn();this.spawnClock=.65+this.random()*.4}
    for(const jet of this.jets){
      jet.age+=dt;jet.phase+=dt
      if(jet.state==='flying'){jet.y-=jet.speed*dt;jet.x+=Math.sin(jet.phase*1.8+jet.id)*13*dt;jet.angle=Math.sin(jet.phase*2)*.08}
      else{jet.vy+=330*dt;jet.x+=jet.vx*dt;jet.y+=jet.vy*dt;jet.angle+=dt*2.8;jet.smoke+=dt;if(jet.smoke>.06){jet.smoke=0;this.particle('smoke',jet.x,jet.y,'#46545d')}}
    }
    for(const bullet of this.bullets){
      bullet.px=bullet.x;bullet.py=bullet.y;bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.age+=dt
      let nearest:Jet|null=null,distance=Infinity
      for(const jet of this.jets){if(jet.state!=='flying')continue;const d=segmentDistance(jet.x,jet.y, {x:bullet.px,y:bullet.py},bullet);const along=Math.hypot(jet.x-bullet.px,jet.y-bullet.py);if(d<jet.scale*24+3&&along<distance){nearest=jet;distance=along}}
      if(nearest){this.hit(nearest);bullet.age=3}
    }
    for(const p of this.debris){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.kind==='spark'){p.vy+=150*dt;p.vx*=Math.exp(-dt*1.5)}else{p.vy-=dt*12;p.size+=dt*8}}
    for(const m of this.muzzles)m.age+=dt
    let n=0;for(const jet of this.jets){if(jet.y>-70&&jet.y<590&&jet.x>-100&&jet.x<740)this.jets[n++]=jet;else this.jetPool.push(jet)}this.jets.length=n
    n=0;for(const b of this.bullets){if(b.age<1.4&&b.x>-20&&b.x<660&&b.y>-30&&b.y<510)this.bullets[n++]=b;else this.bulletPool.push(b)}this.bullets.length=n
    n=0;for(const p of this.debris){if(p.age<p.life)this.debris[n++]=p;else this.debrisPool.push(p)}this.debris.length=n
    n=0;for(const m of this.muzzles)if(m.age<.075)this.muzzles[n++]=m;this.muzzles.length=n
  }
  private fire(hand:ArcadeHand){
    if(this.bullets.length>=MAX_BULLETS)return
    let dx=hand.direction.x,dy=hand.direction.y,n=Math.hypot(dx,dy)||1;dx/=n;dy/=n
    // Small assistance cone retains physical projectiles and requires pointing toward the target.
    let chosen:Jet|null=null,best=Infinity
    for(const jet of this.jets){
      if(jet.state!=='flying')continue
      const x=jet.x-hand.tip.x,y=jet.y-hand.tip.y,d=Math.hypot(x,y)||1,cos=(x*dx+y*dy)/d
      if(cos>.94&&d<best){chosen=jet;best=d}
    }
    if(chosen){const x=chosen.x-hand.tip.x,y=chosen.y-hand.tip.y,d=Math.hypot(x,y)||1;dx=x/d;dy=y/d}
    const b=this.bulletPool.pop()??{} as Bullet
    Object.assign(b,{x:hand.tip.x,y:hand.tip.y,px:hand.tip.x,py:hand.tip.y,vx:dx*790,vy:dy*790,age:0,side:hand.id});this.bullets.push(b)
    this.muzzles.push({x:hand.tip.x,y:hand.tip.y,age:0,side:hand.id});this.rounds++;this.flash=1;this.recoil=1
  }
  hit(jet:Jet){
    if(jet.state!=='flying')return false
    jet.state='falling';jet.age=0;jet.vx=(this.random()-.5)*95;jet.vy=30;this.score+=100;this.kills++
    for(let i=0;i<22;i++)this.particle('spark',jet.x,jet.y,['#fff1ac','#ffb940','#f76539'][i%3]!)
    for(let i=0;i<5;i++)this.particle('smoke',jet.x,jet.y,'#5b5c66')
    return true
  }
  private particle(kind:Debris['kind'],x:number,y:number,color:string){
    if(this.debris.length>=MAX_DEBRIS)return
    const r=this.random,a=r()*6.28,s=kind==='spark'?30+r()*160:10+r()*25,p=this.debrisPool.pop()??{} as Debris
    Object.assign(p,{x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-(kind==='smoke'?20:0),age:0,life:kind==='spark'?.18+r()*.42:.5+r()*.7,size:kind==='spark'?1+r()*3:5+r()*9,kind,color});this.debris.push(p)
  }
}
