import type { Landmark } from './papa-game'
export type Tracking={type:'tracking';landmarks:Landmark[][];handedness:{categoryName:string}[][];timestamp:number;generation:number;duration:number;face:Landmark[];faceTimestamp?:number}
type Options={worker?:boolean;bitmap?:boolean;cpu?:boolean;fastHands?:boolean}
type TrackingPacket=Omit<Tracking,'face'> & {face:Landmark[]|null;faceTimestamp?:number}
type Runtime={init(base:string,options?:Options):Promise<void>;detect(source:CanvasImageSource,timestamp:number):Omit<TrackingPacket,'generation'>;close():void}
declare global{interface Window{RubberVisionRuntime:new()=>Runtime}}
const scriptLoads=new Map<string,Promise<void>>()
function script(url:string){let promise=scriptLoads.get(url);if(!promise){promise=new Promise<void>((resolve,reject)=>{const element=document.createElement('script');element.src=url;element.onload=()=>resolve();element.onerror=()=>reject(new Error('Model loader unavailable'));document.head.append(element)});scriptLoads.set(url,promise);promise.catch(()=>scriptLoads.delete(url))}return promise}
export class TrackingBudget{
  interval=45
  average=18
  private fastHands:boolean
  private onMainThread=false
  constructor(fastHands=false){
    this.fastHands=fastHands
    if(fastHands)this.interval=24
  }
  mainThread(){
    this.onMainThread=true
    this.interval=this.fastHands ? 39 : 90
  }
  sample(ms:number){
    if(!Number.isFinite(ms)||ms<0)return
    this.average+=.18*(ms-this.average)
    if(this.fastHands){
      const floor=this.onMainThread ? 36 : 16
      this.interval=Math.max(floor,Math.min(92,this.average*(this.onMainThread ? 1.55 : 1.12)))
    }else this.interval=Math.max(45,Math.min(160,this.average*2.1))
  }
}
/** One frame in flight, with worker and main-thread paths sharing the same model settings. */
export class RubberTracking{
  private worker:Worker|null=null
  private runtime:Runtime|null=null
  private captureCanvas=document.createElement('canvas')
  private context:CanvasRenderingContext2D
  private bitmapMode=true
  private allowWorker=true
  private preferCPU=false
  private fastHands=false
  private face:Landmark[]=[]
  private faceTimestamp:number|undefined
  private disposed=false
  private epoch=0
  private initCancel:(()=>void)|null=null
  readonly budget:TrackingBudget
  onresult:((data:Tracking)=>void)|null=null
  onerror:((error:Error)=>void)|null=null
  constructor(options:Options={}){
    this.allowWorker=options.worker!==false
    this.preferCPU=options.cpu===true
    this.bitmapMode=options.bitmap!==false
    this.fastHands=options.fastHands===true
    this.budget=new TrackingBudget(this.fastHands)
    this.context=this.captureCanvas.getContext('2d',{willReadFrequently:true})!
  }
  private deliver(packet:TrackingPacket){
    this.budget.sample(packet.duration)
    if(packet.face!==null){
      this.face=packet.face
      this.faceTimestamp=packet.faceTimestamp??packet.timestamp
    }
    this.onresult?.({...packet,face:this.face,faceTimestamp:this.faceTimestamp})
  }
  async init(base:string){
    const token=this.epoch
    if(this.allowWorker&&typeof Worker==='function'&&typeof OffscreenCanvas==='function'){
      try{await this.initWorker(base);if(this.disposed||token!==this.epoch)throw new Error('Cancelled');return}
      catch(error){this.worker?.terminate();this.worker=null;if(this.disposed||token!==this.epoch)throw error}
    }
    await script(base+'mediapipe/vision_bundle.js');await script(base+'papa-runtime.js');await script(base+'rubber-runtime.js')
    if(this.disposed||token!==this.epoch)throw new Error('Cancelled')
    const runtime=new window.RubberVisionRuntime()
    try{await runtime.init(base,{cpu:this.preferCPU,fastHands:this.fastHands});if(this.disposed||token!==this.epoch){runtime.close();throw new Error('Cancelled')}this.runtime=runtime;this.budget.mainThread()}
    catch(error){runtime.close();throw error}
  }
  private initWorker(base:string){return new Promise<void>((resolve,reject)=>{
    let initialized=false
    this.worker=new Worker(new URL(`${import.meta.env.BASE_URL}rubber-tracker.js`,location.href))
    const timer=setTimeout(()=>{this.initCancel=null;reject(new Error('Worker initialization timed out'))},35000)
    this.initCancel=()=>{clearTimeout(timer);reject(new Error('Cancelled'))}
    this.worker.onerror=()=>{clearTimeout(timer);this.initCancel=null;if(initialized)this.onerror?.(new Error('인식 엔진이 중단됐어요.'));else reject(new Error('Worker unavailable'))}
    this.worker.onmessage=({data})=>{
      if(data.type==='ready'){clearTimeout(timer);this.initCancel=null;initialized=true;resolve()}
      else if(data.type==='error'){clearTimeout(timer);if(this.initCancel){this.initCancel=null;reject(new Error(data.message))}else this.onerror?.(new Error(data.message))}
      else if(data.type==='tracking')this.deliver(data)
    }
    this.worker.postMessage({type:'init',base,cpu:this.preferCPU,fastHands:this.fastHands})
  })}
  async frame(video:HTMLVideoElement,timestamp:number,generation:number){
    if(this.disposed)return
    const token=this.epoch
    const width=this.fastHands ? Math.max(1,Math.min(video.videoWidth,Math.round(video.videoWidth*512/Math.max(video.videoWidth,video.videoHeight)))) : 640
    const height=Math.max(1,Math.round(width*video.videoHeight/video.videoWidth))
    if(this.worker&&this.bitmapMode&&typeof createImageBitmap==='function'){
      try{
        const bitmap=await createImageBitmap(video,{resizeWidth:width,resizeHeight:height})
        if(this.disposed||token!==this.epoch){bitmap.close();return}
        try{this.worker.postMessage({type:'frame',bitmap,timestamp,generation},[bitmap]);return}catch(error){bitmap.close();throw error}
      }catch{this.bitmapMode=false}
    }
    if(this.disposed||token!==this.epoch)return
    if(this.captureCanvas.width!==width||this.captureCanvas.height!==height){this.captureCanvas.width=width;this.captureCanvas.height=height}
    this.context.drawImage(video,0,0,width,height)
    if(this.worker){const image=this.context.getImageData(0,0,width,height);this.worker.postMessage({type:'frame',pixels:image.data,width,height,timestamp,generation},[image.data.buffer]);return}
    if(!this.runtime)throw new Error('Tracker is not initialized')
    this.deliver({...this.runtime.detect(this.captureCanvas,timestamp),generation})
  }
  close(){if(this.disposed)return;this.disposed=true;this.epoch++;this.initCancel?.();this.initCancel=null;this.worker?.terminate();this.worker=null;this.runtime?.close();this.runtime=null;this.onresult=this.onerror=null;this.captureCanvas.width=this.captureCanvas.height=1}
}
