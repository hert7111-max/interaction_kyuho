import type { Landmark } from './papa-game'
export type Tracking={type:'tracking';landmarks:Landmark[][];handedness:{categoryName:string}[][];eyes:Landmark[][]|null;faceOutline?:Landmark[]|null;timestamp:number;generation:number;duration:number}
type Runtime={init(base:string):Promise<void>;detect(source:CanvasImageSource,timestamp:number,needEyes:boolean):Omit<Tracking,'generation'>;close():void}
declare global{interface Window{PapaVisionRuntime:new()=>Runtime}}
const scriptLoads=new Map<string,Promise<void>>()
function script(url:string){let promise=scriptLoads.get(url);if(!promise){promise=new Promise<void>((resolve,reject)=>{const element=document.createElement('script');element.src=url;element.onload=()=>resolve();element.onerror=()=>reject(new Error('Model loader unavailable'));document.head.append(element)});scriptLoads.set(url,promise);promise.catch(()=>scriptLoads.delete(url))}return promise}
export class TrackingBudget{
  interval=45
  average=18
  sample(ms:number){if(!Number.isFinite(ms)||ms<0)return;this.average+=.15*(ms-this.average);this.interval=Math.max(45,Math.min(160,this.average*2.1))}
}
/** One frame in flight. Feature-detected fallback retains both hands, eyes and 640px model input. */
export class PapaTracking{
  private worker:Worker|null=null
  private runtime:Runtime|null=null
  private captureCanvas=document.createElement('canvas')
  private context:CanvasRenderingContext2D
  private bitmapMode=true
  private allowWorker=true
  private disposed=false
  private epoch=0
  private initCancel:(()=>void)|null=null
  readonly budget=new TrackingBudget()
  onresult:((data:Tracking)=>void)|null=null
  onerror:((error:Error)=>void)|null=null
  constructor(options:{worker?:boolean;bitmap?:boolean}={}){this.allowWorker=options.worker!==false;this.bitmapMode=options.bitmap!==false;this.context=this.captureCanvas.getContext('2d',{willReadFrequently:true})!}
  async init(base:string){
    const token=this.epoch
    if(this.allowWorker&&typeof Worker==='function'&&typeof OffscreenCanvas==='function'){
      try{await this.initWorker(base);if(this.disposed||token!==this.epoch)throw new Error('Cancelled');return}
      catch(error){this.worker?.terminate();this.worker=null;if(this.disposed||token!==this.epoch)throw error}
    }
    await script(base+'mediapipe/vision_bundle.js');await script(base+'papa-runtime.js')
    if(this.disposed||token!==this.epoch)throw new Error('Cancelled')
    const runtime=new window.PapaVisionRuntime()
    try{await runtime.init(base);if(this.disposed||token!==this.epoch){runtime.close();throw new Error('Cancelled')}this.runtime=runtime;this.budget.interval=90}
    catch(error){runtime.close();throw error}
  }
  private initWorker(base:string){return new Promise<void>((resolve,reject)=>{
    let initialized=false
    this.worker=new Worker(new URL(`${import.meta.env.BASE_URL}papa-tracker.js`,location.href))
    const timer=setTimeout(()=>{this.initCancel=null;reject(new Error('Worker initialization timed out'))},35000)
    this.initCancel=()=>{clearTimeout(timer);reject(new Error('Cancelled'))}
    this.worker.onerror=()=>{clearTimeout(timer);this.initCancel=null;if(initialized)this.onerror?.(new Error('인식 엔진이 중단됐어요.'));else reject(new Error('Worker unavailable'))}
    this.worker.onmessage=({data})=>{
      if(data.type==='ready'){clearTimeout(timer);this.initCancel=null;initialized=true;resolve()}
      else if(data.type==='error'){clearTimeout(timer);if(this.initCancel){this.initCancel=null;reject(new Error(data.message))}else this.onerror?.(new Error(data.message))}
      else if(data.type==='tracking'){this.budget.sample(data.duration);this.onresult?.(data)}
    }
    this.worker.postMessage({type:'init',base})
  })}
  async frame(video:HTMLVideoElement,timestamp:number,generation:number,needEyes:boolean){
    if(this.disposed)return
    const token=this.epoch
    if(this.worker&&this.bitmapMode&&typeof createImageBitmap==='function'){
      try{
        const bitmap=await createImageBitmap(video,{resizeWidth:640,resizeHeight:Math.round(640*video.videoHeight/video.videoWidth)})
        if(this.disposed||token!==this.epoch){bitmap.close();return}
        try{this.worker.postMessage({type:'frame',bitmap,timestamp,generation,needEyes},[bitmap]);return}catch(error){bitmap.close();throw error}
      }catch{this.bitmapMode=false}
    }
    const width=640,height=Math.max(1,Math.round(width*video.videoHeight/video.videoWidth))
    if(this.captureCanvas.width!==width||this.captureCanvas.height!==height){this.captureCanvas.width=width;this.captureCanvas.height=height}
    this.context.drawImage(video,0,0,width,height)
    if(this.worker){const image=this.context.getImageData(0,0,width,height);this.worker.postMessage({type:'frame',pixels:image.data,width,height,timestamp,generation,needEyes},[image.data.buffer]);return}
    if(!this.runtime)throw new Error('Tracker is not initialized')
    const data=this.runtime.detect(this.captureCanvas,timestamp,needEyes);this.budget.sample(data.duration)
    this.onresult?.({...data,generation})
  }
  close(){if(this.disposed)return;this.disposed=true;this.epoch++;this.initCancel?.();this.initCancel=null;this.worker?.terminate();this.worker=null;this.runtime?.close();this.runtime=null;this.onresult=this.onerror=null;this.captureCanvas.width=this.captureCanvas.height=1}
}
