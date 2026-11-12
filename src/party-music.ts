export class PartyMusic {
  ctx:AudioContext|null=null
  gain:GainNode|null=null
  timer:ReturnType<typeof setInterval>|undefined
  playing=false
  nextStep=-1
  now=()=>Date.now()/1000
  async unlock(){this.ctx??=new AudioContext();await this.ctx.resume()}
  async start(){
    await this.unlock();if(this.playing)return
    const ctx=this.ctx!;this.gain??=ctx.createGain();this.gain.gain.value=.13;this.gain.connect(ctx.destination);this.playing=true;this.nextStep=-1
    this.timer=setInterval(()=>this.schedule(),80);this.schedule()
  }
  stop(){clearInterval(this.timer);this.playing=false;this.nextStep=-1;if(this.gain&&this.ctx)this.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.08)}
  private tone(freq:number,at:number,len:number,type:OscillatorType,volume:number,slide?:number){
    const ctx=this.ctx!,osc=ctx.createOscillator(),g=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,at);if(slide)osc.frequency.exponentialRampToValueAtTime(slide,at+len);g.gain.setValueAtTime(.001,at);g.gain.exponentialRampToValueAtTime(volume,at+.008);g.gain.exponentialRampToValueAtTime(.001,at+len);osc.connect(g).connect(this.gain!);osc.start(at);osc.stop(at+len+.01)
  }
  private noise(at:number,length:number,volume:number,highpass:number){
    const ctx=this.ctx!,buffer=ctx.createBuffer(1,ctx.sampleRate*length,ctx.sampleRate),values=buffer.getChannelData(0);for(let i=0;i<values.length;i++)values[i]=(Math.random()*2-1)*(1-i/values.length)
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=buffer;filter.type='highpass';filter.frequency.value=highpass;g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.001,at+length);src.connect(filter).connect(g).connect(this.gain!);src.start(at)
  }
  private schedule(){
    if(!this.playing||!this.ctx)return
    const stepLength=60/128/2,world=this.now(),current=Math.floor(world/stepLength)
    if(this.nextStep<current)this.nextStep=current+1
    while(this.nextStep*stepLength<world+.22){
      const step=this.nextStep++,at=this.ctx.currentTime+(step*stepLength-world),beat=step%16
      if(beat%2===0)this.tone(140,at,.22,'sine',.8,42)
      if(beat%4===2){this.noise(at,.12,.25,1100);this.tone(175,at,.09,'triangle',.12)}
      this.noise(at,beat%2?.07:.035,.10,6500)
      const bass=[65.41,65.41,77.78,65.41,87.31,87.31,77.78,58.27][Math.floor(beat/2)]!
      if(beat%2===1)this.tone(bass,at,.19,'triangle',.45)
      const melody=[261.63,311.13,392,466.16,392,311.13,349.23,233.08][beat%8]!
      if(beat%2===1)this.tone(melody,at,.12,'sine',.17)
      if(beat===0||beat===8)for(const f of [261.63,311.13,392])this.tone(f,at,.28,'triangle',.06)
    }
  }
}
