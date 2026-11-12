import type { Action, Player, PlayerState } from './party-types'
export class PartyConnection {
  socket:WebSocket|null=null
  id=''
  session=''
  nickname=''
  offset=0
  connected=false
  stopped=false
  retry=0
  timer:ReturnType<typeof setTimeout>|undefined
  lastError=''
  onWelcome?:(players:Player[])=>void
  onJoined?:(player:Player)=>void
  onLeft?:(id:string)=>void
  onState?:(players:PlayerState[])=>void
  onStatus?:(status:'connecting'|'connected'|'reconnecting'|'error',message?:string)=>void
  join(nickname:string){this.nickname=nickname;this.stopped=false;this.connect()}
  private connect(){
    if(this.stopped)return
    this.onStatus?.(this.session?'reconnecting':'connecting')
    const protocol=location.protocol==='https:'?'wss:':'ws:'
    const socket=new WebSocket(`${protocol}//${location.host}/party`);this.socket=socket
    socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'join',nickname:this.nickname,resume:this.session||undefined})))
    socket.addEventListener('message',event=>{
      let data;try{data=JSON.parse(event.data)}catch{return}
      if(typeof data.time==='number')this.offset=data.time-Date.now()
      if(data.type==='welcome'){
        this.id=data.id;this.session=data.session;this.connected=true;this.retry=0;this.lastError='';this.onWelcome?.(data.players);this.onStatus?.('connected')
      }else if(data.type==='joined')this.onJoined?.(data.player)
      else if(data.type==='left')this.onLeft?.(data.id)
      else if(data.type==='state')this.onState?.(data.players)
      else if(data.type==='error'){this.lastError=data.message;this.onStatus?.('error',data.message)}
    })
    socket.addEventListener('close',event=>{
      this.connected=false
      if(this.stopped)return
      if(event.code===1008){this.onStatus?.('error',this.lastError||'연결이 종료됐어요. 다시 입장해주세요.');return}
      if(!this.session&&this.retry>=3){this.onStatus?.('error','댄스장에 연결할 수 없어요. 서버 주소를 확인해주세요.');return}
      this.onStatus?.('reconnecting');this.timer=setTimeout(()=>this.connect(),Math.min(5000,500*2**this.retry++))
    })
    socket.addEventListener('error',()=>{})
  }
  move(dx:number,dz:number){if(this.connected&&this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({type:'move',dx,dz}))}
  action(action:Action){if(this.connected&&this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({type:'action',action}))}
  now(){return(Date.now()+this.offset)/1000}
  close(){this.stopped=true;clearTimeout(this.timer);this.connected=false;this.socket?.close(1000,'Leaving');this.socket=null}
}
