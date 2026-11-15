/* global ParticleVisionRuntime */
let runtime,frameCanvas,frameContext
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      importScripts(data.base+'mediapipe/vision_bundle.js',data.base+'papa-runtime.js',data.base+'particle-runtime.js')
      runtime=new ParticleVisionRuntime();await runtime.init(data.base)
      self.postMessage({type:'ready'})
    }catch(error){self.postMessage({type:'error',message:String(error)})}
  }
  if(data.type==='frame'){
    try{
      let source=data.bitmap
      if(data.pixels){
        if(!frameCanvas){frameCanvas=new OffscreenCanvas(data.width,data.height);frameContext=frameCanvas.getContext('2d')}
        if(frameCanvas.width!==data.width||frameCanvas.height!==data.height){frameCanvas.width=data.width;frameCanvas.height=data.height}
        frameContext.putImageData(new ImageData(data.pixels,data.width,data.height),0,0);source=frameCanvas
      }
      const result=runtime.detect(source,data.timestamp)
      result.generation=data.generation;self.postMessage(result)
    }catch(error){self.postMessage({type:'error',message:String(error)})}
    finally{if(data.bitmap)data.bitmap.close()}
  }
}
