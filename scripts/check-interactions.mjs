import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, runInContext } from 'node:vm'

const events=new Map(), globals=new Map(), docEvents=new Map()
let time=0, requested=0
const drawing=new Proxy({}, { get:(_,name)=>name==='createImageData'?((w,h)=>({data:new Uint8ClampedArray(w*h*4)})):name==='createPattern'?(()=>({})):()=>{},set:()=>true })
const canvas={width:0,height:0,getContext:()=>drawing,addEventListener:(name,fn)=>events.set(name,fn)}
const root={innerHTML:''}, preference={matches:false}
const sandbox={document:{hidden:false,querySelector:id=>id==='#city'?canvas:root,createElement:()=>({width:0,height:0,getContext:()=>drawing}),addEventListener:(name,fn)=>docEvents.set(name,fn)},innerWidth:1440,innerHeight:900,devicePixelRatio:2,performance:{now:()=>time},matchMedia:()=>preference,addEventListener:(name,fn)=>globals.set(name,fn),requestAnimationFrame(){requested++},Math}
sandbox.window=sandbox
const context=createContext(sandbox)
runInContext(stripTypeScriptTypes(readFileSync(new URL('../src/main.ts',import.meta.url),'utf8').replace("import './style.css'",''),{mode:'strip'}),context)
const inspect=s=>runInContext(s,context)
const state=()=>sandbox.__city
const click=(extra={})=>events.get('pointerdown')({pointerType:'mouse',button:0,preventDefault(){},...extra})
const advance=ms=>{time+=ms;inspect('draw(performance.now())')}
assert.equal((root.innerHTML.match(/<canvas/g)||[]).length,1)
assert.ok(!/<button|<p\b|<h[1-6]|<span|<a\b/.test(root.innerHTML),'Only the artwork is visible')
assert.equal(canvas.width,2880);assert.equal(canvas.height,1800)
assert.ok(state().buildings>70)
assert.equal(state().transformed,0)
assert.equal(requested,0,'The intact skyline does not waste animation frames')
console.log('✓ Fullscreen panorama contains only a canvas, with no visible text or buttons')

click();assert.equal(state().clicks,1);assert.equal(state().transformed,1)
const first=state().lastSelected
assert.ok(inspect('buildings.find(b=>b.id===lastSelected).pieces.length >= 6'))
assert.ok(inspect('visible(buildings.find(b=>b.id===lastSelected))'))
assert.ok(requested>0)
assert.equal(inspect('drawPiece(buildings.find(b=>b.id===lastSelected),buildings.find(b=>b.id===lastSelected).pieces[0],performance.now())'),true)
advance(2200)
assert.equal(inspect('drawPiece(buildings.find(b=>b.id===lastSelected),buildings.find(b=>b.id===lastSelected).pieces[0],performance.now())'),false)
const after=requested;advance(10);assert.equal(requested,after,'Animation stops after the pieces settle')
click();assert.notEqual(state().lastSelected,first)
assert.equal(state().transformed,2)
console.log('✓ Each click randomly splits a visible building; texture fades and the pieces settle')

for(let i=0;i<90;i++){advance(2000);click()}
assert.ok(state().clicks>80,'Clicks remain useful after all eligible buildings have transformed')
assert.ok(inspect('buildings.every(b=>b.pieces.length<=15)'))
assert.ok(inspect('buildings.filter(b=>b.pieces.length).every(b=>Math.abs(b.pieces.reduce((a,p)=>a+p.w*p.h,0)-b.w*b.h)<.001)'))
assert.ok(inspect('buildings.every(b=>b.pieces.every(p=>palette.includes(p.color)&&Number.isFinite(p.dx)&&Number.isFinite(p.dy)&&b.y+p.y+p.dy>=29.99))'))
assert.ok(state().pieces<=state().buildings*15)
console.log('✓ Fragments cover each original facade exactly, use the cool palette, and remain within a bounded budget')

const count=state().clicks
click({button:2});assert.equal(state().clicks,count)
click({pointerType:'touch'});assert.equal(state().clicks,count+1)
events.get('keydown')({key:'Enter',repeat:false,preventDefault(){}})
assert.equal(state().clicks,count+2)
events.get('keydown')({key:' ',repeat:true,preventDefault(){}})
assert.equal(state().clicks,count+2)
console.log('✓ Touch and keyboard work; secondary clicks and held keys do not duplicate actions')

for(const [w,h] of [[390,844],[320,568],[844,390],[2560,1080]]){
  const previous=state().transformed
  sandbox.innerWidth=w;sandbox.innerHeight=h;globals.get('resize')()
  assert.equal(state().transformed,previous,'Resize preserves transformed buildings')
  assert.ok(state().scale*2000>=w&&state().scale*1000>=h,'Panorama covers both viewport dimensions')
  const id=state().lastSelected;advance(2000);click()
  assert.notEqual(state().lastSelected,id)
  assert.ok(inspect('visible(buildings.find(b=>b.id===lastSelected))'))
}
preference.matches=true;advance(2000);click();advance(700)
assert.equal(inspect('drawPiece(buildings.find(b=>b.id===lastSelected),buildings.find(b=>b.id===lastSelected).pieces.at(-1),performance.now())'),false)
sandbox.document.hidden=true;docEvents.get('visibilitychange')()
sandbox.document.hidden=false;advance(5000);docEvents.get('visibilitychange')()
console.log('✓ Mobile, landscape, resize, reduced motion, and background restoration work')
