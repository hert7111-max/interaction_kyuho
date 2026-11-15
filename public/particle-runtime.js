/* global PapaVisionRuntime */
self.ParticleVisionRuntime=class extends self.PapaVisionRuntime {
  async init(base){await super.init(base,{handsOnly:true})}
  detect(source,timestamp){
    const start=performance.now(),hands=this.hands.detectForVideo(source,timestamp)
    return{type:'tracking',landmarks:hands.landmarks,handedness:hands.handedness,timestamp,duration:performance.now()-start}
  }
}
