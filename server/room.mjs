import { randomUUID } from 'node:crypto'
import { ACTIONS, ROOM, cleanNickname, movePosition, randomAvatar } from '../shared/world.mjs'

export class PartyRoom {
  players=new Map()
  dormant=new Map()
  constructor({random=Math.random,now=()=>Date.now()}={}){this.random=random;this.now=now}
  join(nickname,resume){
    nickname=cleanNickname(nickname)
    if(!nickname)throw new Error('닉네임을 한 글자 이상 입력해주세요.')
    if(this.players.size>=ROOM.capacity)throw new Error('지금은 만석이에요. 잠시 후 다시 입장해주세요.')
    const old=typeof resume==='string'?this.dormant.get(resume):null
    let player
    if(old&&old.expires>this.now()&&old.player.nickname===nickname){player=old.player;this.dormant.delete(resume)}
    else {
      const angle=this.random()*Math.PI*2,radius=1+this.random()*2
      player={id:randomUUID(),session:randomUUID(),nickname,avatar:randomAvatar(this.random),x:Math.sin(angle)*radius,z:2+Math.cos(angle)*radius,yaw:0,action:'dance',actionAt:this.now(),moving:false,dx:0,dz:0,lastInput:this.now(),previousAction:'dance'}
    }
    player.dx=0;player.dz=0;player.moving=false;player.lastInput=this.now();this.players.set(player.id,player)
    return player
  }
  leave(id){const player=this.players.get(id);if(!player)return;this.players.delete(id);player.dx=0;player.dz=0;player.moving=false;this.dormant.set(player.session,{player,expires:this.now()+30000})}
  input(id,dx,dz){
    const p=this.players.get(id);if(!p||!Number.isFinite(dx)||!Number.isFinite(dz)||Math.abs(dx)>1.001||Math.abs(dz)>1.001)return false
    p.dx=dx;p.dz=dz;p.lastInput=this.now()
    if(Math.hypot(dx,dz)>.05&&(p.action==='lie'||p.action==='wave')){p.action='idle';p.actionAt=this.now()}
    return true
  }
  action(id,action){
    const p=this.players.get(id);if(!p||!ACTIONS.includes(action))return false
    if(action==='wave')p.previousAction=p.action==='dance'?'dance':'idle'
    p.action=action;p.actionAt=this.now()
    if(action==='lie'){p.dx=0;p.dz=0;p.moving=false}
    return true
  }
  tick(dt){
    const now=this.now()
    for(const p of this.players.values()){
      if(now-p.lastInput>500){p.dx=0;p.dz=0}
      const moving=Math.hypot(p.dx,p.dz)>.05
      if(moving){const pos=movePosition(p.x,p.z,p.dx,p.dz,dt);p.moving=Math.hypot(pos.x-p.x,pos.z-p.z)>.001;p.x=pos.x;p.z=pos.z;p.yaw=Math.atan2(p.dx,p.dz)}else p.moving=false
      if(p.action==='wave'&&now-p.actionAt>2600){p.action=p.previousAction;p.actionAt=now}
    }
    for(const [session,entry]of this.dormant)if(entry.expires<now)this.dormant.delete(session)
  }
  describe(player){const {id,nickname,avatar,x,z,yaw,action,actionAt,moving}=player;return{id,nickname,avatar,x,z,yaw,action,actionAt,moving}}
  roster(){return[...this.players.values()].map(p=>this.describe(p))}
  snapshot(){return[...this.players.values()].map(({id,x,z,yaw,action,actionAt,moving})=>({id,x:Math.round(x*1000)/1000,z:Math.round(z*1000)/1000,yaw,action,actionAt,moving}))}
}
