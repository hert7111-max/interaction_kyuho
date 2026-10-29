import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = '<canvas id="city" tabindex="0" role="application" aria-label="뉴욕 실사 파노라마. 건물을 클릭하거나 터치하면 그 건물만 밝은 색의 다양한 크기 블록으로 바뀝니다. 변환은 유지됩니다. 방향키로 건물을 선택하고 엔터로 변환할 수 있습니다."></canvas>'
const canvas=document.querySelector<HTMLCanvasElement>('#city')!
const ctx=canvas.getContext('2d')!
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)')
const W=1670,H=1280,KEY='city-photo-blocks-v1'
const colors=['#075bff','#00aaff','#12dfff','#00e59a','#34f58c','#81ffce','#d8fff3','#f7fdff','#3682ff']
type Point=[number,number]
type Piece={x:number;y:number;w:number;h:number;dx:number;dy:number;sw:number;sh:number;depth:number;color:string;delay:number}
type Region={id:number;polygon:Point[];x:number;y:number;w:number;h:number;mask:HTMLCanvasElement|null;cutout:HTMLCanvasElement|null;pieces:Piece[];at:number}
let width=innerWidth,height=innerHeight,scale=1,ox=0,oy=0,ready=false,framePending=false
let complete=false,finalAt=Infinity,lastSelected=-1,keyboardIndex=0
let sceneSeed=Math.floor(Math.random()*0xffffffff),seed=sceneSeed
const selected=new Set<number>()
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&s.version===1&&Array.isArray(s.selected)){sceneSeed=s.seed>>>0;seed=sceneSeed;for(const id of s.selected)if(Number.isInteger(id))selected.add(id);complete=s.complete===true}}catch{/* Storage may be unavailable in an embedded or private browser. */}
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const range=(a:number,b:number)=>a+random()*(b-a)
const choose=<T,>(a:T[])=>a[Math.floor(random()*a.length)]!
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v))
const regions:Region[]=[]
function add(polygon:Point[]){const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);regions.push({id:regions.length,polygon,x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y,mask:null,cutout:null,pieces:[],at:-Infinity})}
// Distant buildings share small backdrop regions; foreground outlines override them.
const backgroundCuts=[0,95,210,340,475,610,750,875,1010,1140,1285,1410,1540,1670]
for(let i=0;i<backgroundCuts.length-1;i++){const x=backgroundCuts[i]!,r=backgroundCuts[i+1]!;add([[x,548],[r,548],[r,H],[x,H]])}
// Hand-traced visible New York architecture in the photograph's coordinate system.
add([[1026,578],[1026,511],[1033,499],[1038,458],[1043,499],[1052,510],[1052,580]])
add([[367,802],[368,647],[377,630],[419,628],[432,644],[432,799]])
add([[482,936],[484,680],[498,655],[503,640],[523,640],[539,660],[547,680],[547,927]])
add([[717,773],[718,627],[726,620],[727,607],[743,605],[748,631],[755,632],[759,775]])
add([[766,879],[769,620],[784,616],[785,601],[817,605],[817,621],[832,623],[836,874]])
add([[812,791],[814,597],[820,596],[821,577],[841,576],[844,603],[854,610],[854,787]])
add([[849,789],[852,477],[862,466],[867,449],[875,444],[878,397],[885,385],[891,309],[896,382],[902,394],[907,444],[916,451],[923,473],[928,697],[923,788]])
add([[1107,1001],[1108,622],[1128,613],[1149,621],[1171,611],[1181,627],[1181,999]])
add([[1248,871],[1254,611],[1281,602],[1297,612],[1305,867]])
add([[1390,807],[1397,433],[1517,507],[1526,539],[1563,542],[1573,794]])
add([[95,1003],[96,719],[114,710],[116,680],[135,675],[146,691],[153,718],[156,996]])
add([[147,860],[154,706],[174,699],[177,677],[197,686],[206,718],[216,860]])
add([[0,1108],[0,405],[53,420],[71,434],[77,497],[82,558],[91,631],[100,723],[111,841],[122,995],[107,1053],[51,1102]])
add([[170,916],[171,777],[208,757],[244,757],[255,780],[256,904]])
add([[248,857],[248,743],[290,718],[370,711],[415,727],[417,854]])
add([[565,1003],[568,650],[577,646],[579,629],[603,627],[608,617],[630,625],[635,642],[648,650],[649,998]])
add([[449,1111],[449,815],[469,801],[489,796],[523,809],[531,1108]])
add([[676,991],[677,786],[697,762],[732,757],[754,770],[761,965]])
add([[1190,962],[1190,774],[1201,756],[1234,750],[1254,769],[1258,955]])
add([[1315,904],[1315,708],[1345,694],[1351,682],[1382,690],[1403,704],[1403,902]])
add([[1434,1003],[1435,822],[1463,806],[1558,800],[1596,820],[1612,990]])
add([[1588,1280],[1588,812],[1629,801],[1658,809],[1670,827],[1670,1280]])
add([[923,1055],[923,704],[944,687],[1080,686],[1107,704],[1110,1048]])
add([[173,1023],[174,875],[199,864],[234,857],[268,872],[270,1014]])
add([[274,1060],[274,928],[292,918],[327,910],[352,923],[367,1053]])
add([[124,1280],[124,1009],[163,988],[206,990],[232,1004],[235,1280]])
add([[500,1106],[501,1012],[517,994],[638,993],[679,1012],[681,1106]])
add([[707,1153],[708,995],[730,976],[771,974],[789,959],[805,968],[817,987],[854,993],[855,1152]])
add([[866,979],[864,834],[877,823],[894,827],[900,843],[904,979]])
add([[228,1280],[230,1144],[264,1124],[310,1134],[347,1160],[350,1280]])
add([[352,1228],[354,1135],[379,1111],[420,1106],[461,1119],[475,1223]])
add([[549,1280],[551,1158],[589,1130],[626,1135],[658,1152],[668,1280]])
add([[860,1280],[862,1174],[885,1151],[916,1144],[922,1119],[1019,1125],[1021,1161],[1082,1172],[1094,1280]])
add([[1200,1280],[1201,944],[1274,920],[1275,868],[1353,865],[1362,892],[1432,904],[1489,934],[1494,1280]])

function path(c:CanvasRenderingContext2D,points:Point[],dx=0,dy=0){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0]+dx,p[1]+dy):c.moveTo(p[0]+dx,p[1]+dy));c.closePath()}
function contains(r:Region,x:number,y:number){if(x<r.x||x>r.x+r.w||y<r.y||y>r.y+r.h)return false;let inside=false;for(let i=0,j=r.polygon.length-1;i<r.polygon.length;j=i++){const a=r.polygon[i]!,b=r.polygon[j]!;if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
function hit(x:number,y:number){for(let i=regions.length-1;i>=0;i--)if(contains(regions[i]!,x,y))return regions[i]!;return null}
function visibleIds(){const ids=new Set<number>();for(let y=8;y<height;y+=18)for(let x=8;x<width;x+=18){const r=hit((x-ox)/scale,(y-oy)/scale);if(r)ids.add(r.id)}return ids}
function save(){try{localStorage.setItem(KEY,JSON.stringify({version:1,seed:sceneSeed,selected:[...selected],complete}))}catch{/* Session state still remains when storage is blocked. */}}
function partitions(x:number,y:number,w:number,h:number,depth:number,out:Piece[]){
  if(depth<=0||w<24||h<32){out.push({x,y,w,h,dx:range(-18,18),dy:range(-72,-8),sw:range(.82,1.26),sh:range(.78,1.21),depth:range(7,23),color:choose(colors),delay:range(0,160)});return}
  if((w/h>range(.55,1.2)&&w>35)||h<50){const cut=range(.24,.76)*w;partitions(x,y,cut,h,depth-1,out);partitions(x+cut,y,w-cut,h,depth-1,out)}
  else{const cut=range(.24,.76)*h;partitions(x,y,w,cut,depth-1,out);partitions(x,y+cut,w,h-cut,depth-1,out)}
}
function makePieces(r:Region){seed=(sceneSeed^Math.imul(r.id+1,2654435761))>>>0;r.pieces=[];partitions(0,0,r.w,r.h,r.w*r.h>45000?3:2,r.pieces)}
function shade(color:string,n:number){return '#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*n)).toString(16).padStart(2,'0')).join('')}
function polygon(points:Point[],color:string){path(ctx,points);ctx.fillStyle=color;ctx.fill()}
function activate(clientX:number,clientY:number){
  if(!ready||complete)return
  const r=hit((clientX-ox)/scale,(clientY-oy)/scale)
  if(!r||selected.has(r.id))return
  selected.add(r.id);r.at=performance.now();makePieces(r);lastSelected=r.id
  const visible=visibleIds()
  if(visible.size&&[...visible].every(id=>selected.has(id))){complete=true;finalAt=r.at+1600}
  save();schedule()
}
function drawPiece(r:Region,p:Piece,now:number){
  const t=clamp((now-r.at-p.delay)/(reducedMotion.matches?220:1200)),e=1-Math.pow(1-t,4)
  const x=r.x+p.x+p.dx*e,y=r.y+p.y+p.dy*e,w=p.w*(1+(p.sw-1)*e),h=p.h*(1+(p.sh-1)*e),d=p.depth*e
  ctx.save();ctx.translate(x,y);ctx.globalAlpha=e
  polygon([[w,0],[w+d,d*.48],[w+d,h+d*.48],[w,h]],shade(p.color,.8))
  polygon([[0,h],[w,h],[w+d,h+d*.48],[d,h+d*.48]],shade(p.color,.9))
  ctx.fillStyle=p.color;ctx.fillRect(0,0,w+.3,h+.3)
  ctx.globalAlpha=1-clamp(t/.62)
  if(r.cutout&&ctx.globalAlpha>0)ctx.drawImage(r.cutout,p.x,p.y,p.w,p.h,0,0,w,h)
  ctx.restore();return t<1
}
// An irregular guillotine partition covers the entire view at completion, including sky.
const mosaic:Piece[]=[]
seed=sceneSeed^0x31fab2
partitions(0,0,W,H,6,mosaic)
function drawMosaic(alpha:number){ctx.save();ctx.globalAlpha=alpha;for(const p of mosaic){ctx.fillStyle=p.color;ctx.fillRect(p.x-.5,p.y-.5,p.w+1,p.h+1);const d=Math.min(10,p.w*.07,p.h*.07);ctx.fillStyle=shade(p.color,.88);ctx.fillRect(p.x+p.w-d,p.y,d,p.h);ctx.fillStyle=shade(p.color,.95);ctx.fillRect(p.x,p.y+p.h-d,p.w,d)}ctx.restore()}
const photograph=new Image()
function initialize(){
  const full=document.createElement('canvas');full.width=W;full.height=H
  full.getContext('2d')!.drawImage(photograph,0,0,photograph.naturalWidth,photograph.naturalHeight,0,0,1920,1280)
  for(let i=0;i<regions.length;i++){
    const r=regions[i]!,mask=document.createElement('canvas');mask.width=Math.ceil(r.w);mask.height=Math.ceil(r.h)
    const c=mask.getContext('2d')!;path(c,r.polygon,-r.x,-r.y);c.fillStyle='#7eadd1';c.fill()
    c.globalCompositeOperation='destination-out'
    for(let j=i+1;j<regions.length;j++){path(c,regions[j]!.polygon,-r.x,-r.y);c.fill()}
    c.globalCompositeOperation='source-over';r.mask=mask
    const cutout=document.createElement('canvas');cutout.width=mask.width;cutout.height=mask.height
    const cc=cutout.getContext('2d')!;cc.drawImage(full,-r.x,-r.y);cc.globalCompositeOperation='destination-in';cc.drawImage(mask,0,0);cc.globalCompositeOperation='source-over';r.cutout=cutout
    if(selected.has(r.id)){r.at=-10000;makePieces(r)}
  }
  for(const id of [...selected])if(!regions[id])selected.delete(id)
  ready=true;canvas.classList.add('ready');if(complete)finalAt=-10000;resize()
}
function draw(now=performance.now()){
  framePending=false
  if(!ready)return
  const dpr=Math.min(devicePixelRatio||1,2)
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height)
  ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*ox,dpr*oy)
  const finalProgress=complete?clamp((now-finalAt)/(reducedMotion.matches?180:950)):0
  if(finalProgress<1){
    ctx.drawImage(photograph,0,0,photograph.naturalWidth,photograph.naturalHeight,0,0,1920,1280)
    for(const r of regions)if(selected.has(r.id)&&r.mask)ctx.drawImage(r.mask,r.x,r.y)
    let moving=false
    for(const r of regions)if(selected.has(r.id))for(const p of r.pieces)if(drawPiece(r,p,now))moving=true
    if(moving)schedule()
  }
  if(complete){drawMosaic(finalProgress);if(finalProgress<1)schedule()}
}
function schedule(){if(!framePending&&!document.hidden){framePending=true;requestAnimationFrame(draw)}}
function resize(){width=innerWidth;height=innerHeight;scale=Math.max(width/W,height/H);ox=(width-W*scale)/2;oy=(height-H*scale)/2;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);draw()}
canvas.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();activate(event.clientX,event.clientY)})
canvas.addEventListener('pointermove',event=>{const r=hit((event.clientX-ox)/scale,(event.clientY-oy)/scale);canvas.style.cursor=r&&!selected.has(r.id)&&!complete?'pointer':'default'})
canvas.addEventListener('contextmenu',event=>event.preventDefault())
canvas.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key))return
  event.preventDefault();const ids=[...visibleIds()].filter(id=>!selected.has(id));if(!ids.length)return
  if(event.key.startsWith('Arrow'))keyboardIndex=(keyboardIndex+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+ids.length)%ids.length
  else if(!event.repeat){const r=regions[ids[keyboardIndex%ids.length]!]!;let clicked=false;for(let y=r.y+3;y<r.y+r.h&&!clicked;y+=8)for(let x=r.x+3;x<r.x+r.w&&!clicked;x+=8)if(hit(x,y)?.id===r.id){activate(x*scale+ox,y*scale+oy);clicked=true}}
})
addEventListener('resize',resize)
document.addEventListener('visibilitychange',()=>{if(!document.hidden)draw()})
photograph.onload=initialize
photograph.onerror=()=>{canvas.classList.remove('ready')}
if(selected.size)canvas.classList.add('ready')
if(complete){ready=true;finalAt=-10000}else photograph.src='/images/new-york-panorama.jpg'
resize()
Object.defineProperty(window,'__city',{get:()=>({ready,transformed:selected.size,selected:[...selected],visible:[...visibleIds()],lastSelected,complete,pieces:regions.reduce((n,r)=>n+r.pieces.length,0),scale,ox,oy})})
