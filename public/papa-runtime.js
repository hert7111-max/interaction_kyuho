/* global Vision */
// Shared by the worker and DOM fallback; same models, input size and eye contours.
self.PapaVisionRuntime=class {
  constructor(){this.hands=null;this.face=null;this.loops=[];this.index=0;this.binaryUrl=null;this.cancelled=false}
  async init(base,options={}){
    this.cancelled=false
    const vision=await Vision.FilesetResolver.forVisionTasks(base+'mediapipe/wasm')
    const originalBinary=vision.wasmBinaryPath
    // Lossless transport compression. Browsers without streaming decompression use the original WASM.
    if(typeof DecompressionStream==='function'){
      try{
        const response=await fetch(vision.wasmBinaryPath+'.gz')
        if(!response.ok||!response.body)throw new Error('No compressed runtime')
        const blob=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).blob()
        this.binaryUrl=URL.createObjectURL(new Blob([blob],{type:'application/wasm'}))
        vision.wasmBinaryPath=this.binaryUrl
      }catch{/* Original runtime remains available on restricted in-app browsers. */}
    }
    const preferCPU=options.cpu===true
    const make=async(Task,model,options)=>{
      const baseOptions={modelAssetPath:base+'mediapipe/'+model}
      if(!preferCPU){
        try{return await Task.createFromOptions(vision,{...options,baseOptions:{...baseOptions,delegate:'GPU'}})}
        catch{/* Continue with CPU inference. */}
      }
      return await Task.createFromOptions(vision,{...options,baseOptions:{...baseOptions,delegate:'CPU'}})
    }
    const initialize=async()=>{
      this.hands=await make(Vision.HandLandmarker,'hand_landmarker.task',{
        runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,
        minTrackingConfidence:options.fastHands ? .36 : .5,
        ...(options.fastHands ? {minHandPresenceConfidence:.42} : {}),
      })
      if(this.cancelled){this.hands.close();this.hands=null;throw new Error('Cancelled')}
      if(!options.handsOnly)this.face=await make(Vision.FaceLandmarker,'face_landmarker.task',{runningMode:'VIDEO',numFaces:1})
      if(this.cancelled){this.close();throw new Error('Cancelled')}
    }
    try{
      try{await initialize()}catch(error){
        if(!this.binaryUrl||this.cancelled)throw error
        if(this.hands)this.hands.close();if(this.face)this.face.close();this.hands=this.face=null
        URL.revokeObjectURL(this.binaryUrl);this.binaryUrl=null;vision.wasmBinaryPath=originalBinary
        await initialize()
      }
      if(options.handsOnly)return
      const loop=edges=>{
        const result=[edges[0].start],visited=new Set(result)
        while(result.length<edges.length){const current=result[result.length-1];let next;for(const e of edges){const other=e.start===current?e.end:e.end===current?e.start:undefined;if(other!==undefined&&!visited.has(other)){next=other;break}}if(next===undefined)break;result.push(next);visited.add(next)}
        return result
      }
      this.loops=[loop(Vision.FaceLandmarker.FACE_LANDMARKS_LEFT_EYE),loop(Vision.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE)]
    }catch(error){this.close();throw error}
  }
  detect(source,timestamp,needEyes=true,full=false){
    const start=performance.now(),hands=this.hands.detectForVideo(source,timestamp)
    let eyes=null,faceOutline=null
    const cadence=needEyes?2:4
    if(this.index++%cadence===0||full){const face=this.face.detectForVideo(source,timestamp).faceLandmarks[0];eyes=face?this.loops.map(loop=>loop.map(i=>face[i])):[];faceOutline=face?[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109].map(i=>face[i]):[]}
    return {type:'tracking',landmarks:hands.landmarks,handedness:hands.handedness,eyes,faceOutline,timestamp,duration:performance.now()-start}
  }
  close(){this.cancelled=true;if(this.hands)this.hands.close();if(this.face)this.face.close();this.hands=this.face=null;if(this.binaryUrl)URL.revokeObjectURL(this.binaryUrl);this.binaryUrl=null}
}
