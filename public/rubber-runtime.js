/* global PapaVisionRuntime */
self.RubberVisionRuntime=class extends PapaVisionRuntime {
  fastHands=false
  facePoints=[]
  faceTimestamp=-Infinity
  handFramesSinceFace=0

  async init(base, options={}){
    this.fastHands=options.fastHands===true
    await super.init(base,options)
  }

  detect(source,timestamp){
    const start=performance.now(),hands=this.hands.detectForVideo(source,timestamp)
    const interval=this.facePoints.length ? 78 : 42
    const age=timestamp-this.faceTimestamp
    const due=age>=interval && (!this.facePoints.length || this.handFramesSinceFace>0)
    if(!this.fastHands||due){
      this.facePoints=this.face.detectForVideo(source,timestamp).faceLandmarks[0]||[]
      this.faceTimestamp=timestamp
      this.handFramesSinceFace=0
      return {
        type:'tracking',landmarks:hands.landmarks,handedness:hands.handedness,
        face:this.facePoints,faceTimestamp:this.faceTimestamp,timestamp,duration:performance.now()-start,
      }
    }
    this.handFramesSinceFace++
    // Keep high-rate hand packets small while the last face estimate is still current.
    return {
      type:'tracking',landmarks:hands.landmarks,handedness:hands.handedness,
      face:null,timestamp,duration:performance.now()-start,
    }
  }
}
