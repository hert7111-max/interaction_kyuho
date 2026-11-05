export type Phase = 'ready' | 'descending' | 'gripping' | 'lifting' | 'transporting' | 'releasing' | 'returning'
export type ToyKind = 'kid' | 'bunny' | 'bear' | 'dino' | 'dog' | 'chick'
export type ToyMode = 'floor' | 'held' | 'falling' | 'chute' | 'won'
export type Toy = { id:number; name:string; kind:ToyKind; color:string; accent:string; scale:number; x:number; y:number; z:number; yaw:number; tiltX:number; tiltZ:number; height:number; mode:ToyMode; vy:number; bounce:number; chuteTime:number }
export const PIT_Y = 2.64
export const TOP_Y = 6.30
export const EXIT = {x:-1.65,z:1.34}
export const LIMITS = {x:1.92,z:1.57}
export const clamp = (v:number,min:number,max:number) => Math.max(min,Math.min(max,v))
const ease = (t:number) => {t=clamp(t,0,1);return t*t*(3-2*t)}
const lerp = (a:number,b:number,t:number) => a+(b-a)*t
const descriptions: [string,ToyKind,string,string][] = [
  ['빨간 티셔츠 짱구','kid','#E63946','#FFD60A'],['딸기 토끼','bunny','#efa4b1','#fce5ce'],['민트 공룡','dino','#79b9a0','#ffe4a2'],['꿀단지 곰','bear','#d49c57','#e85e4d'],
  ['파자마 짱구','kid','#719dc3','#d9e6d9'],['흰둥이','dog','#f7efe0','#cf664a'],['라벤더 토끼','bunny','#b5a3cc','#f4d9ba'],['노란 병아리','chick','#efc75c','#e38e4f'],
  ['초록 티셔츠 짱구','kid','#8ebda0','#f4d36d'],['밀크티 곰','bear','#cfae8c','#7caeae'],['보라 공룡','dino','#ab9fc1','#edc78b'],['초코 곰','bear','#976a52','#deb56c'],
  ['빨간 티셔츠 짱구','kid','#E63946','#FFD60A'],['복숭아 토끼','bunny','#e8bba5','#f5e7c6'],['하늘 티셔츠 짱구','kid','#88bac9','#e8b66b'],
]
export function createToys():Toy[] {
  const slots = [[-1.72,-1.28],[-.60,-1.27],[.58,-1.27],[1.72,-1.27],[-1.73,-.16],[-.60,-.13],[.58,-.10],[1.70,-.13],[-.65,.96],[.55,.98],[1.68,1.03],[-1.14,-.73],[1.16,-.75],[.02,.42],[1.15,.45]]
  return descriptions.map((d,i) => {
    const scale = i>10 ? .54 : d[1]==='bunny' ? .65 : .74
    const height = (d[1]==='bunny'?1.84:d[1]==='dino'?1.6:1.5)*scale
    return {id:i,name:d[0],kind:d[1],color:d[2],accent:d[3],scale,x:slots[i]![0]!,y:PIT_Y,z:slots[i]![1]!,yaw:[-.18,.24,-.12,.1,.3,-.2,.12,-.17,.16,-.24,.15][i%11]!,tiltX:0,tiltZ:0,height,mode:'floor',vy:0,bounce:0,chuteTime:0}
  })
}
export class ClawGame {
  phase:Phase='ready'
  phaseTime=0
  time=0
  x=0
  y=TOP_Y
  z=-.1
  opening=1
  attempts=0
  won=0
  toys=createToys()
  held:Toy|null=null
  candidate:Toy|null=null
  stable=false
  lastResult:'none'|'miss'|'slipped'|'won'='none'
  lastPrize:Toy|null=null
  targetY=3.55
  gripOffset=0
  slipPhase:Phase='lifting'
  slipTime=.6
  start={x:0,y:TOP_Y,z:0}
  random:()=>number
  onEvent?:(event:'drop'|'grip'|'slip'|'win'|'ready',toy?:Toy)=>void
  constructor(random:()=>number=Math.random){this.random=random}
  get locked(){return this.phase!=='ready'}
  move(dx:number,dz:number,dt:number){
    if(this.locked||this.won===this.toys.length)return
    const length=Math.max(1,Math.hypot(dx,dz)), speed=1.65
    this.x=clamp(this.x+dx/length*dt*speed,-LIMITS.x,LIMITS.x)
    this.z=clamp(this.z+dz/length*dt*speed,-LIMITS.z,LIMITS.z)
  }
  drop(){
    if(this.locked||this.won===this.toys.length)return false
    this.attempts++;this.lastResult='none';this.held=null;this.stable=false
    this.candidate=this.toys.filter(t=>t.mode==='floor').sort((a,b)=>Math.hypot(a.x-this.x,a.z-this.z)-Math.hypot(b.x-this.x,b.z-this.z))[0]??null
    if(this.candidate&&Math.hypot(this.candidate.x-this.x,this.candidate.z-this.z)>.66)this.candidate=null
    this.targetY=this.candidate?this.candidate.y+this.candidate.height+.34:PIT_Y+.8
    this.transition('descending');this.onEvent?.('drop');return true
  }
  transition(phase:Phase){this.phase=phase;this.phaseTime=0;this.start={x:this.x,y:this.y,z:this.z}}
  private grab(){
    if(!this.candidate){this.lastResult='miss';return}
    const toy=this.candidate,distance=Math.hypot(toy.x-this.x,toy.z-this.z)
    const quality=clamp(1-distance/.68,0,1)
    if(this.random() > .40+quality*.58){this.lastResult='miss';return}
    this.held=toy;toy.mode='held';this.gripOffset=this.y-toy.y
    this.stable=this.random()<.28+quality*.64
    this.slipPhase=this.random()<.8?'lifting':'transporting';this.slipTime=.3+this.random()*.55
    this.onEvent?.('grip',toy)
  }
  private release(slipped=false){
    if(!this.held)return
    const toy=this.held;toy.mode='falling';toy.vy=slipped?-.2:0;toy.bounce=0
    this.held=null
    if(slipped){this.lastResult='slipped';this.onEvent?.('slip',toy)}
  }
  update(dt:number){
    dt=clamp(dt,0,.05);this.time+=dt;this.phaseTime+=dt
    const t=this.phaseTime
    switch(this.phase){
      case 'ready':break
      case 'descending':this.y=lerp(this.start.y,this.targetY,ease(t/1.8));if(t>=1.8)this.transition('gripping');break
      case 'gripping':this.opening=1-ease(t/.9)*.92;if(t>=.9){this.grab();this.transition('lifting')}break
      case 'lifting':
        this.y=lerp(this.start.y,TOP_Y,ease(t/2.1))
        if(this.held&&!this.stable&&this.slipPhase==='lifting'&&t/2.1>=this.slipTime)this.release(true)
        if(t>=2.1)this.transition('transporting');break
      case 'transporting':
        this.x=lerp(this.start.x,EXIT.x,ease(t/2));this.z=lerp(this.start.z,EXIT.z,ease(t/2))
        if(this.held&&!this.stable&&this.slipPhase==='transporting'&&t/2>=this.slipTime)this.release(true)
        if(t>=2)this.transition('releasing');break
      case 'releasing':
        this.opening=lerp(.08,1,ease(t/.8))
        if(t>=.35&&this.held)this.release()
        if(t>=2.3)this.transition('returning');break
      case 'returning':
        this.x=lerp(this.start.x,0,ease(t/1.6));this.z=lerp(this.start.z,-.1,ease(t/1.6))
        if(t>=1.6){this.opening=1;this.y=TOP_Y;this.candidate=null;this.transition('ready');this.onEvent?.('ready')}
        break
    }
    if(this.held){
      this.held.x=this.x+Math.sin(this.time*3)*.035
      this.held.z=this.z+Math.sin(this.time*2.5)*.025
      this.held.y=this.y-this.gripOffset
      this.held.tiltX=Math.sin(this.time*3)*.09*(this.stable?1:2.8)
      this.held.tiltZ=Math.sin(this.time*2.5)*.08*(this.stable?1:2.8)
    }
    for(const toy of this.toys){
      if(toy.mode==='falling'){
        toy.vy-=9.8*dt;toy.y+=toy.vy*dt;toy.tiltZ+=dt*.6
        if(toy.y<=PIT_Y){
          if(Math.abs(toy.x-EXIT.x)<.54&&Math.abs(toy.z-EXIT.z)<.55){toy.mode='chute';toy.chuteTime=0;toy.tiltX=.1}
          else {toy.y=PIT_Y;if(toy.vy<-.85&&toy.bounce<2){toy.vy*=-.22;toy.bounce++}else{toy.vy=0;toy.mode='floor';toy.tiltX=0;toy.tiltZ=0;this.separate(toy)}}
        }
      }else if(toy.mode==='chute'){
        toy.chuteTime+=dt
        const p=toy.chuteTime
        toy.x=EXIT.x;toy.y=lerp(PIT_Y,.84,ease(p/.75));toy.z=lerp(EXIT.z,2.68,ease((p-.35)/.85))
        toy.tiltX=Math.sin(Math.min(1,p/1.2)*Math.PI)*.9
        if(p>=1.2){toy.mode='won';toy.y=.84;toy.z=2.68;toy.tiltX=0;toy.tiltZ=0;toy.yaw=0;this.won++;this.lastPrize=toy;this.lastResult='won';this.onEvent?.('win',toy)}
      }
    }
  }
  private separate(toy:Toy){
    for(const other of this.toys){
      if(other===toy||other.mode!=='floor')continue
      const dx=toy.x-other.x,dz=toy.z-other.z,d=Math.hypot(dx,dz),radius=(toy.scale+other.scale)*.36
      if(d<radius){const n=d||1;toy.x=clamp(toy.x+(dx||.1)/n*(radius-d)*.5,-1.95,1.95);toy.z=clamp(toy.z+dz/n*(radius-d)*.5,-1.55,1.55)}
    }
    // A slipped toy settles outside the opening instead of hovering over it.
    if(Math.abs(toy.x-EXIT.x)<.54&&Math.abs(toy.z-EXIT.z)<.55)toy.z=EXIT.z-.62
  }
  reset(){
    if(this.locked)return false
    this.toys=createToys();this.won=0;this.attempts=0;this.held=null;this.candidate=null;this.lastPrize=null;this.lastResult='none';this.x=0;this.y=TOP_Y;this.z=-.1;this.opening=1;return true
  }
}
