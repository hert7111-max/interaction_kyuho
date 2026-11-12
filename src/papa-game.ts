export type Vec={x:number;y:number}
export type Landmark=Vec&{z?:number}
export type Aim={id:string;tip:Vec;direction:Vec;pointing:boolean;foreshortened?:boolean}
export type Person={id:number;x:number;y:number;vx:number;vy:number;rotation:number;spin:number;scale:number;variant:number;phase:number;speed:number;state:'climbing'|'shocked'|'falling'|'landed';stateTime:number;smokeTime:number;impact:boolean}
export type Beam={id:string;from:Vec;to:Vec;target:number|null;power:number}
export type Particle=Vec&{vx:number;vy:number;age:number;life:number;size:number;kind:'smoke'|'spark'|'blood';color:string;rotation:number}
export type Stain=Vec&{age:number;life:number;radius:number;seed:number}
export const RAINBOW=['#ff3b5c','#ff8b32','#ffe449','#6dff8d','#43caff','#5b72ff','#c377ff'] as const
export const PERSON_VARIANTS=14
export const FALL_GRAVITY=1150
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
    const radius=person.scale*34
    const near=Math.hypot(dx/(person.scale*38),dy/(person.scale*58))<1.3
    const hit=near||(aim.foreshortened?distance<160:along>0&&cross<radius+Math.min(65,along*.1))
    const score=near?distance*.08:distance+cross*1.4
    if(hit&&score<best){selected=person;best=score}
  }
  return selected
}
export function floorExtent(person:Pick<Person,'rotation'|'scale'>){return (Math.abs(Math.cos(person.rotation))*45+Math.abs(Math.sin(person.rotation))*26)*person.scale}
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
  impacts=0
  constructor(width:number,height=900,random:()=>number=Math.random){this.width=width;this.height=height;this.random=random;this.reset()}
  reset(){this.people=[];this.particles=[];this.stains=[];this.beams=[];this.impacts=0;this.spawnTime=0;this.spawnIndex=0;this.accumulator=0;for(let i=0;i<Math.min(8,Math.max(4,Math.floor(this.width/210)));i++)this.spawn(this.height*.28+this.random()*this.height*.55)}
  spawn(y=this.height+50){
    if(this.people.length>=24)return
    const scale=.78+this.random()*.44
    const x=45+this.random()*Math.max(0,this.width-90)
    this.people.push({id:++this.serial,x,y,vx:0,vy:0,rotation:0,spin:0,scale,variant:this.spawnIndex++%PERSON_VARIANTS,phase:this.random()*Math.PI*2,speed:24+this.random()*28,state:'climbing',stateTime:0,smokeTime:0,impact:false})
  }
  update(dt:number,aims:Aim[]){
    if(!this.running){this.beams=[];return}
    this.accumulator+=Math.min(dt,.08)
    // Aim is evaluated before integration, and each person receives only one state transition per hit.
    this.beams=[]
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
    if(this.particles.length>=850)return
    const random=this.random,angle=random()*Math.PI*2,speed=kind==='smoke'?12+random()*28:kind==='blood'?65+random()*240:80+random()*200
    this.particles.push({kind,x,y,vx:Math.cos(angle)*speed,vy:kind==='blood'?-80-random()*230:kind==='smoke'?-20-random()*40:Math.sin(angle)*speed,age:0,life:kind==='smoke'?.6+random()*1:kind==='blood'?.5+random()*.7:.12+random()*.3,size:kind==='smoke'?6+random()*10:kind==='blood'?1.7+random()*3.5:1+random()*2,color,rotation:random()*Math.PI*2})
  }
  private step(dt:number){
    this.time+=dt;this.spawnTime-=dt
    if(this.spawnTime<=0){this.spawn();this.spawnTime=.95+this.random()*.95}
    for(const person of this.people){
      person.stateTime+=dt;person.phase+=dt*(person.state==='climbing'?3.7:22)
      if(person.state==='climbing'){
        person.y-=person.speed*dt;person.x+=Math.sin(person.phase*.48+person.id)*dt*5
        person.x=Math.max(30,Math.min(this.width-30,person.x))
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
          if(!person.impact){person.impact=true;this.impacts++;this.stains.push({x:person.x,y:this.height-1,age:0,life:1.7,radius:22+this.random()*22,seed:this.random()});for(let i=0;i<25;i++)this.particle('blood',person.x,this.height-3,i%3?'#c63357':'#ff5b72')}
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
    this.stains=this.stains.filter(s=>s.age<s.life)
    this.particles=this.particles.filter(p=>p.age<p.life)
    this.people=this.people.filter(p=>p.y>-100&&(p.state!=='landed'||p.stateTime<.8))
  }
}
