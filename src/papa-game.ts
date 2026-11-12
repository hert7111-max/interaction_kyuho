export type Vec={x:number;y:number}
export type Landmark=Vec&{z?:number}
export type Aim={id:string;tip:Vec;direction:Vec;pointing:boolean;foreshortened?:boolean}
export type Person={id:number;x:number;y:number;vx:number;vy:number;rotation:number;spin:number;scale:number;variant:number;phase:number;speed:number;state:'climbing'|'shocked'|'falling'|'landed';stateTime:number;smokeTime:number;impact:boolean}
export type Beam={id:string;from:Vec;to:Vec;target:number|null;power:number}
export type Particle=Vec&{vx:number;vy:number;age:number;life:number;size:number;kind:'smoke'|'spark'|'blood';color:string;rotation:number}
export type Stain=Vec&{age:number;life:number;radius:number;seed:number}
export const RAINBOW=['#ff3b5c','#ff8b32','#ffe449','#6dff8d','#43caff','#5b72ff','#c377ff'] as const
export const PERSON_VARIANTS=12
export const FALL_GRAVITY=1150
export const MAX_PEOPLE=30
export const MAX_PARTICLES=850
export const MIN_CLIMB_SPEED=30
export const MAX_CLIMB_SPEED=65
export function isPointing(hand:Landmark[],aspect=1){
  if(hand.length<21)return false
  const wrist=hand[0]!,mcp=hand[5]!,pip=hand[6]!,tip=hand[8]!
  const vector=(a:Landmark,b:Landmark)=>({x:(a.x-b.x)*aspect,y:a.y-b.y,z:((a.z??0)-(b.z??0))*aspect})
  const a=vector(mcp,pip),b=vector(tip,pip),tw=vector(tip,wrist),pw=vector(pip,wrist)
  const norm=(v:{x:number;y:number;z:number})=>Math.hypot(v.x,v.y,v.z)
  const angle=(a.x*b.x+a.y*b.y+a.z*b.z)/Math.max(.000001,norm(a)*norm(b))
  return angle<-.28&&norm(tw)>norm(pw)*1.035
}
export function chooseTarget(aim:Aim,people:Person[]):Person|null{
  if(!aim.pointing)return null
  let selected:Person|null=null,best=Infinity
  for(const person of people){
    if(person.state!=='climbing'&&person.state!=='shocked')continue
    const dx=person.x-aim.tip.x,dy=person.y-aim.tip.y,distance=Math.hypot(dx,dy)
    const along=dx*aim.direction.x+dy*aim.direction.y,cross=Math.abs(dx*aim.direction.y-dy*aim.direction.x)
    const radius=person.scale*30
    const near=Math.hypot(dx/(person.scale*34),dy/(person.scale*72))<1.3
    const hit=near||(aim.foreshortened?distance<160:along>0&&cross<radius+Math.min(65,along*.1))
    const score=near?distance*.08:distance+cross*1.4
    if(hit&&score<best){selected=person;best=score}
  }
  return selected
}
export function floorExtent(person:Pick<Person,'rotation'|'scale'>){const cosine=Math.cos(person.rotation);return (Math.abs(Math.sin(person.rotation))*34+(cosine>=0?cosine*60:-cosine*76))*person.scale}
export class PapaGame{
  people:Person[]=[]
  particles:Particle[]=[]
  stains:Stain[]=[]
  beams:Beam[]=[]
  width:number
  height:number
  time=0
  running=true
  private serial=0
  private spawnTime=0
  private accumulator=0
  private random:()=>number
  private spawnIndex=0
  private personPool:Person[]=[]
  private particlePool:Particle[]=[]
  private stainPool:Stain[]=[]
  impacts=0
  constructor(width:number,height=900,random:()=>number=Math.random){this.width=width;this.height=height;this.random=random;this.reset()}
  reset(){
    this.personPool.push(...this.people);this.particlePool.push(...this.particles);this.stainPool.push(...this.stains)
    this.people.length=this.particles.length=this.stains.length=this.beams.length=0
    this.impacts=0;this.spawnTime=0;this.spawnIndex=0;this.accumulator=0
    const count=Math.min(10,Math.max(6,Math.floor(this.width/210)+2))
    for(let i=0;i<count;i++)this.spawn(this.height*.25+this.random()*this.height*.6)
  }
  spawn(y=this.height+50){
    if(this.people.length>=MAX_PEOPLE)return
    const scale=.82+this.random()*.28,x=40+this.random()*Math.max(0,this.width-80)
    const person=this.personPool.pop()??{} as Person
    Object.assign(person,{id:++this.serial,x,y,vx:0,vy:0,rotation:0,spin:0,scale,variant:this.spawnIndex++%PERSON_VARIANTS,phase:this.random()*Math.PI*2,speed:MIN_CLIMB_SPEED+this.random()*(MAX_CLIMB_SPEED-MIN_CLIMB_SPEED),state:'climbing',stateTime:0,smokeTime:0,impact:false})
    this.people.push(person)
  }
  update(dt:number,aims:Aim[]){
    if(!this.running){this.beams.length=0;return}
    this.accumulator+=Math.min(dt,.08)
    // Aim is evaluated before integration, and each person receives only one state transition per hit.
    this.beams.length=0
    for(const aim of aims){
      if(!aim.pointing)continue
      const target=chooseTarget(aim,this.people)
      const far={x:aim.tip.x+aim.direction.x*2400,y:aim.tip.y+aim.direction.y*2400}
      this.beams.push({id:aim.id,from:{...aim.tip},to:target?{x:target.x,y:target.y-6*target.scale}:far,target:target?.id??null,power:1})
      if(target?.state==='climbing')this.hit(target)
    }
    while(this.accumulator>=1/120){this.step(1/120);this.accumulator-=1/120}
  }
  hit(person:Person){
    if(person.state!=='climbing')return false
    person.state='shocked';person.stateTime=0;person.vx=(this.random()-.5)*140;person.vy=-65-this.random()*80;person.spin=(this.random()<.5?-1:1)*(2+this.random()*4)
    for(let i=0;i<16;i++)this.particle('spark',person.x,person.y,RAINBOW[i%7]!)
    return true
  }
  private particle(kind:Particle['kind'],x:number,y:number,color:string){
    if(this.particles.length>=MAX_PARTICLES)return
    const random=this.random,angle=random()*Math.PI*2,speed=kind==='smoke'?12+random()*28:kind==='blood'?65+random()*240:80+random()*200
    const particle=this.particlePool.pop()??{} as Particle
    Object.assign(particle,{kind,x,y,vx:Math.cos(angle)*speed,vy:kind==='blood'?-80-random()*230:kind==='smoke'?-20-random()*40:Math.sin(angle)*speed,age:0,life:kind==='smoke'?.6+random()*1:kind==='blood'?.5+random()*.7:.12+random()*.3,size:kind==='smoke'?6+random()*10:kind==='blood'?1.7+random()*3.5:1+random()*2,color,rotation:random()*Math.PI*2});this.particles.push(particle)
  }
  private step(dt:number){
    this.time+=dt;this.spawnTime-=dt
    if(this.spawnTime<=0){this.spawn();this.spawnTime=.9+this.random()*.5}
    for(const person of this.people){
      person.stateTime+=dt;person.phase+=dt*(person.state==='climbing'?4.5:22)
      if(person.state==='climbing'){
        person.y-=person.speed*(1+.10*Math.sin(person.phase*2))*dt
        person.x+=Math.sin(person.phase*.45+person.id)*dt*5
        person.rotation=Math.sin(person.phase)*.025
        person.x=Math.max(34,Math.min(this.width-34,person.x))
      }else if(person.state==='shocked'){
        person.rotation=Math.sin(person.stateTime*57)*.13;person.y-=dt*7
        if(person.stateTime>=.4){person.state='falling';person.stateTime=0;person.rotation=0}
      }else if(person.state==='falling'){
        person.vy+=FALL_GRAVITY*dt;person.x+=person.vx*dt;person.y+=person.vy*dt;person.rotation+=person.spin*dt
        const radius=26*person.scale
        if(person.x<radius){person.x=radius;person.vx=Math.abs(person.vx)*.4}
        if(person.x>this.width-radius){person.x=this.width-radius;person.vx=-Math.abs(person.vx)*.4}
        const extent=floorExtent(person)
        if(person.y+extent>=this.height){
          person.y=this.height-extent;person.state='landed';person.stateTime=0;person.vx=0;person.vy=0
          if(!person.impact){person.impact=true;this.impacts++;const stain=this.stainPool.pop()??{} as Stain;Object.assign(stain,{x:person.x,y:this.height-1,age:0,life:1.7,radius:22+this.random()*22,seed:this.random()});this.stains.push(stain);for(let i=0;i<25;i++)this.particle('blood',person.x,this.height-3,i%3?'#c63357':'#ff5b72')}
        }
      }
      if(person.state==='shocked'||person.state==='falling'&&person.stateTime<.9){
        person.smokeTime+=dt
        if(person.smokeTime>.055){person.smokeTime=0;this.particle('smoke',person.x+(this.random()-.5)*25,person.y-10,'#adc2d1');if(person.state==='shocked')this.particle('spark',person.x,person.y,RAINBOW[Math.floor(this.random()*7)]!)}
      }
    }
    for(const p of this.particles){
      p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt
      if(p.kind==='blood'){p.vy+=850*dt;if(p.y>this.height-1){p.y=this.height-1;p.vy=0;p.vx*=Math.exp(-dt*15)}}
      else if(p.kind==='smoke'){p.vx*=Math.exp(-dt*.8);p.vy-=dt*9;p.size+=dt*9}
      else{p.vy+=150*dt;p.vx*=Math.exp(-dt*2)}
    }
    this.stains.forEach(s=>s.age+=dt)
    // Compact in place; reuse expired objects instead of allocating three new arrays at 120Hz.
    let write=0
    for(let i=0;i<this.stains.length;i++){const item=this.stains[i]!;if(item.age<item.life)this.stains[write++]=item;else this.stainPool.push(item)}
    this.stains.length=write;write=0
    for(let i=0;i<this.particles.length;i++){const item=this.particles[i]!;if(item.age<item.life)this.particles[write++]=item;else this.particlePool.push(item)}
    this.particles.length=write;write=0
    for(let i=0;i<this.people.length;i++){const item=this.people[i]!;if(item.y>-100&&(item.state!=='landed'||item.stateTime<.8))this.people[write++]=item;else this.personPool.push(item)}
    this.people.length=write
  }
}
