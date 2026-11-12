/* global Vision */
// A classic worker is required by MediaPipe's WASM importScripts loader.
let hand, face, human, frameIndex=0
async function create(Task,vision,base,model,options){
  try{return await Task.createFromOptions(vision,{...options,baseOptions:{modelAssetPath:base+'mediapipe/'+model,delegate:'GPU'}})}
  catch{return await Task.createFromOptions(vision,{...options,baseOptions:{modelAssetPath:base+'mediapipe/'+model,delegate:'CPU'}})}
}
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      importScripts(data.base+'mediapipe/vision_bundle.js')
      const vision=await Vision.FilesetResolver.forVisionTasks(data.base+'mediapipe/wasm')
      self.postMessage({type:'progress',stage:'손끝 인식 준비 중…'})
      hand=await create(Vision.HandLandmarker,vision,data.base,'hand_landmarker.task',{runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minTrackingConfidence:.5})
      self.postMessage({type:'progress',stage:'몸의 윤곽 인식 준비 중…'})
      human=await create(Vision.ImageSegmenter,vision,data.base,'selfie_segmenter.tflite',{runningMode:'VIDEO',outputCategoryMask:false,outputConfidenceMasks:true})
      self.postMessage({type:'progress',stage:'입 모양 인식 준비 중…'})
      face=await create(Vision.FaceLandmarker,vision,data.base,'face_landmarker.task',{runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true})
      self.postMessage({type:'ready'})
    }catch(error){self.postMessage({type:'error',message:String(error)})}
  }
  if(data.type==='frame'){
    try{
      if(!hand||!human||!face)throw new Error('Snow tracking is not initialized')
      const hands=hand.detectForVideo(data.bitmap,data.timestamp)
      let mask=null,maskWidth=0,maskHeight=0,faces=null,jaw=null
      // Segmentation and face inference run at half the hand rate; render/physics stay independent.
      if(frameIndex++%2===0||data.full){
        human.segmentForVideo(data.bitmap,data.timestamp,result=>{
          const source=result.confidenceMasks[0]
          mask=new Float32Array(source.getAsFloat32Array());maskWidth=source.width;maskHeight=source.height
        })
        const result=face.detectForVideo(data.bitmap,data.timestamp)
        faces=result.faceLandmarks
        jaw=result.faceBlendshapes[0]?.categories.find(category=>category.categoryName==='jawOpen')?.score??0
      }
      const output={type:'tracking',landmarks:hands.landmarks,handedness:hands.handedness,faces,jaw,mask,maskWidth,maskHeight,timestamp:data.timestamp,generation:data.generation}
      self.postMessage(output,mask?[mask.buffer]:[])
    }catch(error){self.postMessage({type:'error',message:String(error)})}
    finally{data.bitmap.close()}
  }
}
