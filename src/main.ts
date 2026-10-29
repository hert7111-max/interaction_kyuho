import './style.css'

// Everything visible is drawn on this single, edge-to-edge surface.
document.querySelector<HTMLDivElement>('#app')!.innerHTML = '<canvas id="city" tabindex="0" role="application" aria-label="도시 파노라마. 클릭하거나 터치하면 무작위 건물이 분리되어 파랑, 초록, 흰색 블록으로 변합니다. 엔터 또는 스페이스로도 조작할 수 있습니다."></canvas>'
const canvas = document.querySelector<HTMLCanvasElement>('#city')!
const ctx = canvas.getContext('2d')!
const motion = matchMedia('(prefers-reduced-motion: reduce)')
const WORLD_W = 2000, WORLD_H = 1000
const palette = ['#3157d5', '#255ec1', '#1d8680', '#2a9a78', '#a9cdb7', '#e7eee8', '#d8e9ed', '#74a8c7', '#17457e']
const facades = ['#a5b7b8', '#c5ceca', '#a8b8c1', '#6c8b96', '#9bafb2', '#809a9b', '#bac8c5']
type Piece = { x: number; y: number; w: number; h: number; dx: number; dy: number; depth: number; delay: number; color: string }
type Building = { id: number; x: number; y: number; w: number; h: number; depth: number; layer: number; kind: number; seed: number; solid: boolean; color: string; image: HTMLCanvasElement; started: number; pieces: Piece[]; cycle: number }
let width = innerWidth, height = innerHeight, scale = 1, offsetX = 0
let framePending = false, lastTime = performance.now(), clicks = 0
let lastSelected = -1
let seed = 753104
const buildings: Building[] = []
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
const range = (a: number, b: number) => a + random() * (b - a)
const choose = <T,>(items: T[]) => items[Math.floor(random() * items.length)]!
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
function shade(hex: string, factor: number) {
  return '#' + [1, 3, 5].map(i => Math.round(clamp(parseInt(hex.slice(i, i + 2), 16) * factor, 0, 255)).toString(16).padStart(2, '0')).join('')
}
function polygon(c: CanvasRenderingContext2D, points: number[][], fill?: string) {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p[0]!, p[1]!) : c.moveTo(p[0]!, p[1]!)); c.closePath()
  if (fill) { c.fillStyle = fill; c.fill() }
}
function outline(c: CanvasRenderingContext2D, w: number, h: number, kind: number) {
  if (kind === 1) polygon(c, [[0,h],[0,h*.22],[w*.13,h*.22],[w*.13,h*.1],[w*.28,h*.1],[w*.28,0],[w*.72,0],[w*.72,h*.1],[w*.87,h*.1],[w*.87,h*.22],[w,h*.22],[w,h]])
  else if (kind === 2) polygon(c, [[0,h],[0,h*.12],[w*.15,h*.12],[w*.15,0],[w*.83,0],[w*.83,h*.12],[w,h*.12],[w,h]])
  else c.rect(0, 0, w, h)
}
function makeFacade(b: Building) {
  const image = document.createElement('canvas')
  image.width = Math.ceil(b.w + b.depth + 8); image.height = Math.ceil(b.h + b.depth + 110)
  const c = image.getContext('2d')!
  const localSeed = seed; seed = b.seed
  c.translate(2, b.depth + 94)
  const w = b.w, h = b.h, d = b.depth, base = b.solid ? b.color : choose(facades)
  const side = b.solid ? shade(base, .65) : '#294a5c'
  if(b.kind===0) polygon(c, [[w,0],[w+d,-d*.48],[w+d,h-d*.48],[w,h]], side)
  else { c.save();c.translate(d,-d*.48);c.beginPath();outline(c,w,h,b.kind);c.fillStyle=side;c.fill();c.restore() }
  // Thin, regular rows on the shaded side retain the scale of real architecture.
  if (!b.solid && b.kind===0) {
    for (let y = 7; y < h; y += 11) { c.strokeStyle = '#99aeb234'; c.lineWidth = .8; c.beginPath(); c.moveTo(w,y); c.lineTo(w+d,y-d*.48); c.stroke() }
  }
  c.save(); c.beginPath(); outline(c,w,h,b.kind); c.clip()
  c.fillStyle = base; c.fillRect(0,0,w,h)
  if (!b.solid) {
    const style = Math.floor(range(0,4)), cols = Math.max(3,Math.floor(w / range(9,16))), cell = w / cols
    const floor = style === 2 ? 9 : range(10,15)
    const margin = style === 1 ? .23 : .16
    for (let y = 8; y < h - 4; y += floor) {
      c.fillStyle = style === 2 ? '#d7e0dd5c' : '#344d6038'; c.fillRect(0,y-2,w,1)
      for (let col = 0; col < cols; col++) {
        const x = col * cell + cell * margin, ww = cell * (1-margin*2), hh = floor * range(.49,.66)
        const r = random()
        c.fillStyle = r < .08 ? '#b8ced1' : r < .3 ? '#3e5b6b' : r < .8 ? '#213e51' : '#6d939f'
        c.fillRect(x,y,ww,hh)
        c.fillStyle = '#e3e9de66'; c.fillRect(x,y,ww,.8)
        c.fillStyle = '#101f3038'; c.fillRect(x+ww,y,1,hh+1)
        if (style === 0 || style === 2) { c.fillStyle = '#b1c2bf7a'; c.fillRect(x+ww*.47,y,.7,hh) }
        if (r > .95 && style !== 2) { c.fillStyle = '#a1afab'; c.fillRect(x+ww*.35,y+hh-2,ww*.7,3) }
      }
      if (style === 1 && Math.floor(y/floor)%4===0) { c.fillStyle = '#c5cfbf85'; c.fillRect(0,y+floor-3,w,2) }
    }
    // Narrow pilasters, cornices, rooftop machinery, and uneven facade grain.
    if (style !== 2) for (let x=0; x<w; x+=cell*3) { c.fillStyle='#d4d9cb5c'; c.fillRect(x,0,2,h) }
    for (let i=0; i<w*h/65; i++) { c.fillStyle = random()>.5 ? '#f0f5e00e' : '#06162812'; c.fillRect(range(0,w),range(0,h),range(1,3),range(1,6)) }
    c.fillStyle = '#d1dbcd'; c.fillRect(0,0,w,4)
    c.fillStyle = '#233b4b99'; c.fillRect(0,5,w,2)
    c.fillStyle = '#182c4055'; c.fillRect(w-4,0,4,h)
  }
  c.restore()
  // Rooftop and setbacks are cut as architectural silhouettes, never labels.
  if (b.kind === 0) polygon(c, [[0,0],[d,-d*.48],[w+d,-d*.48],[w,0]], b.solid ? shade(base,1.08) : '#c7d2cb')
  else {
    const steps = b.kind === 1 ? [[.28,0,.72],[.13,.1,.28],[.72,.1,.87],[0,.22,.13],[.87,.22,1]] : [[.15,0,.83],[0,.12,.15],[.83,.12,1]]
    for(const [left,top,right] of steps) polygon(c, [[left!*w,top!*h],[left!*w+d,top!*h-d*.48],[right!*w+d,top!*h-d*.48],[right!*w,top!*h]],b.solid ? shade(base,1.07) : '#bfcac5')
  }
  if (!b.solid && b.kind === 0 && b.layer > 0) {
    for(let i=0;i<Math.floor(w/48);i++) { const x=range(8,w-20), rw=range(10,23), rh=range(6,17); c.fillStyle='#314c59'; c.fillRect(x,-rh,rw,rh); polygon(c,[[x,-rh],[x+5,-rh-3],[x+rw+5,-rh-3],[x+rw,-rh]],'#a3b6b4') }
  }
  if (b.kind === 1) {
    const x=w*.5
    c.fillStyle='#38505d'; c.fillRect(x-5,-64,10,64)
    c.fillStyle='#b2c7c6'; c.fillRect(x-3,-65,3,65)
    c.strokeStyle='#264754'; c.lineWidth=1.4; c.beginPath(); c.moveTo(x,-65); c.lineTo(x,-104); c.stroke()
    c.fillStyle='#647e87'; c.fillRect(x-8,-19,16,4)
  }
  seed=localSeed
  return image
}
function add(x:number,base:number,w:number,h:number,layer:number,kind=0,solid=false,color=choose(palette)) {
  const building = { id:buildings.length,x,y:base-h,w,h,depth:range(10,24),layer,kind,seed:Math.floor(range(1,0xffffffff)),solid,color,image:null as unknown as HTMLCanvasElement,started:-Infinity,pieces:[],cycle:0 }
  building.image=makeFacade(building); buildings.push(building)
}
// A wide photographic-style silhouette: fine facades behind large color planes.
for(let x=-60;x<2100;x+=range(35,65)) add(x,range(710,780),range(34,69),range(95,295),0,random()>.8?2:0)
for(let x=-90;x<2110;x+=range(68,105)) add(x,range(960,1020),range(65,108),range(230,540),1,random()>.82?2:0)
add(-62,1020,147,624,2)
add(120,1020,138,530,2,2)
add(306,1020,172,726,2)
add(500,1020,145,570,2,0,true,'#2a62bd')
add(689,1020,164,660,2,2)
add(903,1020,132,760,2,1)
add(1087,1020,146,575,2)
add(1274,1020,168,476,2,0,true,'#258e73')
add(1488,1020,211,795,2,0,true,'#e0ebe5')
add(1752,1020,174,688,2)
add(1952,1020,148,810,2,0,true,'#73a3bd')
for(let x=-100;x<2110;x+=range(88,146)) add(x,range(1070,1130),range(85,149),range(130,339),3,random()>.88?2:0,random()>.79,choose(['#2b5b8a','#126e67','#c8d6d0']))
buildings.sort((a,b)=>a.layer-b.layer || a.y+a.h-b.y-b.h)

const grain = document.createElement('canvas'); grain.width=grain.height=256
const gc = grain.getContext('2d')!, noise=gc.createImageData(256,256)
for(let i=0;i<noise.data.length;i+=4) { const v=Math.floor(range(70,220)); noise.data[i]=v; noise.data[i+1]=v; noise.data[i+2]=v; noise.data[i+3]=11 }
gc.putImageData(noise,0,0)

function visible(b:Building) { return (b.x+b.w+b.depth)*scale+offsetX>0 && b.x*scale+offsetX<width && b.y<930 }
function split(b:Building, now:number) {
  const rows=Math.max(3,Math.min(5,Math.round(b.h/165))), cols=b.w>170&&random()>.65?3:2
  b.pieces=[]; b.started=now; b.cycle++
  const baseColor=choose(palette)
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
    const w=b.w/cols, h=b.h/rows
    b.pieces.push({x:col*w,y:row*h,w,h,dx:(col-(cols-1)/2)*range(34,76)+range(-14,14),dy:Math.max(-b.y-row*h+30,-(rows-row)*range(27,48)-range(15,55)),depth:range(15,30),delay:row*35+range(0,95),color:random()>.78?choose(palette):baseColor})
  }
}
function activate() {
  const now=performance.now()
  let candidates=buildings.filter(b=>visible(b)&&b.layer>=1&&b.kind===0&&b.h>200&&b.started===-Infinity)
  if(!candidates.length) candidates=buildings.filter(b=>visible(b)&&b.layer>=1&&b.kind===0&&b.id!==lastSelected&&now-b.started>1800)
  if(!candidates.length) return
  // Tall foreground silhouettes get enough turns to make each click apparent.
  const prominent=candidates.filter(b=>b.layer===2)
  const b=choose(prominent.length&&random()>.25?prominent:candidates)
  split(b,now); lastSelected=b.id; clicks++; schedule()
}
function drawPiece(b:Building,p:Piece,now:number) {
  const duration=motion.matches?260:1550
  const t=clamp((now-b.started-p.delay)/duration)
  const ease=1-Math.pow(1-t,4)
  const fade=clamp((t-.06)/.64)
  const dx=motion.matches?p.dx*.45:p.dx, dy=motion.matches?p.dy*.45:p.dy
  const x=b.x+p.x+dx*ease, y=b.y+p.y+dy*ease
  const d=b.depth+(p.depth-b.depth)*ease
  const sideY=d*(-.48+ease*1.08)
  ctx.save();ctx.translate(x,y)
  polygon(ctx,[[p.w,0],[p.w+d,sideY],[p.w+d,p.h+sideY],[p.w,p.h]],shade(p.color,.64))
  if(sideY>=0) polygon(ctx,[[0,p.h],[p.w,p.h],[p.w+d,p.h+sideY],[d,p.h+sideY]],shade(p.color,.78))
  else polygon(ctx,[[0,0],[d,sideY],[p.w+d,sideY],[p.w,0]],shade(p.color,1.08))
  ctx.fillStyle=p.color;ctx.fillRect(0,0,p.w+.2,p.h+.2)
  if(fade<1) {
    ctx.globalAlpha=1-fade
    ctx.drawImage(b.image,2+p.x,b.depth+94+p.y,p.w,p.h,0,0,p.w,p.h)
    ctx.globalAlpha=1
  }
  ctx.restore()
  return t<1
}
function draw(now=performance.now()) {
  lastTime=now;framePending=false
  ctx.setTransform(1,0,0,1,0,0)
  ctx.fillStyle='#99b9be';ctx.fillRect(0,0,canvas.width,canvas.height)
  const dpr=Math.min(devicePixelRatio||1,2)
  ctx.setTransform(dpr,0,0,dpr,0,0)
  const pattern=ctx.createPattern(grain,'repeat')
  if(pattern){ctx.fillStyle=pattern;ctx.fillRect(0,0,width,height)}
  ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*offsetX,0)
  // The quieter distant city remains visible in the spaces left by the pieces.
  for(const b of buildings) {
    if(!visible(b)||b.started!==-Infinity)continue
    ctx.globalAlpha=b.layer===0?.46:1
    ctx.drawImage(b.image,b.x-2,b.y-b.depth-94)
  }
  ctx.globalAlpha=1
  let moving=false
  for(const b of buildings) if(b.started!==-Infinity&&visible(b)) {
    // Lower pieces are painted first, so the lifted blocks overlap naturally.
    for(const p of [...b.pieces].sort((a,c)=>c.y-a.y||c.x-a.x)) if(drawPiece(b,p,now))moving=true
  }
  if(moving&&!document.hidden)schedule()
}
function schedule(){if(!framePending){framePending=true;requestAnimationFrame(draw)}}
function resize(){
  width=innerWidth;height=innerHeight
  scale=Math.max(width/WORLD_W,height/WORLD_H)
  offsetX=(width-WORLD_W*scale)/2
  const dpr=Math.min(devicePixelRatio||1,2)
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)
  draw(performance.now())
}
canvas.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();activate()})
canvas.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();if(!event.repeat)activate()}})
canvas.addEventListener('contextmenu',event=>event.preventDefault())
addEventListener('resize',resize)
document.addEventListener('visibilitychange',()=>{if(!document.hidden)draw(performance.now())})
resize()
Object.defineProperty(window,'__city',{get:()=>({clicks,buildings:buildings.length,visible:buildings.filter(visible).length,transformed:buildings.filter(b=>b.started!==-Infinity).length,pieces:buildings.reduce((n,b)=>n+b.pieces.length,0),lastSelected,scale,lastTime})})
