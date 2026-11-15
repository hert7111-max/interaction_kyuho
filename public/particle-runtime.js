/* global Vision */
self.ParticleVisionRuntime=class extends self.PapaVisionRuntime {
  async init(base){
    await super.init(base)
    const edges=Vision.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,loop=[edges[0].start],seen=new Set(loop)
    while(loop.length<edges.length){const current=loop[loop.length-1];let next;for(const edge of edges){const other=edge.start===current?edge.end:edge.end===current?edge.start:undefined;if(other!==undefined&&!seen.has(other)){next=other;break}}if(next===undefined)break;loop.push(next);seen.add(next)}
    this.oval=loop
  }
  detect(source,timestamp){
    const start=performance.now(),hands=this.hands.detectForVideo(source,timestamp)
    let face=null
    if(this.index++%2===0){const landmarks=this.face.detectForVideo(source,timestamp).faceLandmarks[0];face=landmarks?this.oval.map(index=>landmarks[index]):[]}
    return{type:'tracking',landmarks:hands.landmarks,handedness:hands.handedness,face,timestamp,duration:performance.now()-start}
  }
}
