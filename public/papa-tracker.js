/* global Vision */
let hands,face,index=0,eyeLoops=[]
async function make(Task,vision,base,model,options){
  try{return await Task.createFromOptions(vision,{...options,baseOptions:{modelAssetPath:base+'mediapipe/'+model,delegate:'GPU'}})}
  catch{return await Task.createFromOptions(vision,{...options,baseOptions:{modelAssetPath:base+'mediapipe/'+model,delegate:'CPU'}})}
}
function orderedLoop(edges){
  const result=[edges[0].start],visited=new Set(result)
  while(result.length<edges.length){const current=result[result.length-1],next=edges.flatMap(e=>e.start===current?[e.end]:e.end===current?[e.start]:[]).find(i=>!visited.has(i));if(next===undefined)break;result.push(next);visited.add(next)}
  return result
}
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      importScripts(data.base+'mediapipe/vision_bundle.js')
      const vision=await Vision.FilesetResolver.forVisionTasks(data.base+'mediapipe/wasm')
      hands=await make(Vision.HandLandmarker,vision,data.base,'hand_landmarker.task',{runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minTrackingConfidence:.5})
      face=await make(Vision.FaceLandmarker,vision,data.base,'face_landmarker.task',{runningMode:'VIDEO',numFaces:1})
      eyeLoops=[orderedLoop(Vision.FaceLandmarker.FACE_LANDMARKS_LEFT_EYE),orderedLoop(Vision.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE)]
      self.postMessage({type:'ready'})
    }catch(error){self.postMessage({type:'error',message:String(error)})}
  }
  if(data.type==='frame'){
    try{
      if(!hands||!face)throw new Error('Tracker not initialized')
      const result=hands.detectForVideo(data.bitmap,data.timestamp)
      let eyes=null
      if(index++%2===0||data.full){const faces=face.detectForVideo(data.bitmap,data.timestamp);eyes=faces.faceLandmarks[0]?eyeLoops.map(loop=>loop.map(i=>faces.faceLandmarks[0][i])):[]}
      self.postMessage({type:'tracking',landmarks:result.landmarks,handedness:result.handedness,eyes,timestamp:data.timestamp,generation:data.generation})
    }catch(error){self.postMessage({type:'error',message:String(error)})}
    finally{data.bitmap.close()}
  }
}
