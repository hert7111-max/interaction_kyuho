import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {createContext,runInContext} from 'node:vm'
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8').replace("import './style.css'",'')
function setup(storage=new Map(),w=1440,h=900){
 let time=0,requested=0
 const events=new Map(),globals=new Map(),docEvents=new Map(),images=[]
 const draw=new Proxy({}, {get:()=>()=>{},set:()=>true})
 const element=()=>({width:0,height:0,getContext:()=>draw,classList:{add(){},remove(){}},style:{},addEventListener(){}})
 const canvas=element(),root={innerHTML:''};canvas.addEventListener=(k,v)=>events.set(k,v)
 const preference={matches:false}
 const sandbox={document:{hidden:false,querySelector:id=>id==='#city'?canvas:root,createElement:element,addEventListener:(k,v)=>docEvents.set(k,v)},innerWidth:w,innerHeight:h,devicePixelRatio:2,performance:{now:()=>time},matchMedia:()=>preference,requestAnimationFrame(){requested++},addEventListener:(k,v)=>globals.set(k,v),Image:class{naturalWidth=2560;naturalHeight=1707;constructor(){images.push(this)}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Math}
 sandbox.window=sandbox;const context=createContext(sandbox),run=s=>runInContext(s,context)
 run(stripTypeScriptTypes(source,{mode:'strip'}));if(!sandbox.__city.ready)images[0].onload()
 return{sandbox,run,root,canvas,storage,events,globals,preference,state:()=>sandbox.__city,advance(ms){time+=ms;run('draw(performance.now())')},click(x,y,extra={}){events.get('pointerdown')({clientX:x,clientY:y,pointerType:'mouse',button:0,preventDefault(){},...extra})},world(x,y,extra={}){const st=sandbox.__city;this.click(x*st.scale+st.ox,y*st.scale+st.oy,extra)},get requested(){return requested}}
}
const app=setup()
assert.ok(app.state().ready)
assert.equal((app.root.innerHTML.match(/<canvas/g)||[]).length,1)
assert.ok(!/<button|<p\b|<h[1-6]|<span|<a\b/.test(app.root.innerHTML))
assert.equal(app.canvas.width,2880);assert.equal(app.canvas.height,1800)
assert.equal(app.state().transformed,0)
console.log('✓ Fullscreen photograph loads with no visible text or buttons')

app.world(890,560)
assert.equal(app.state().transformed,1)
assert.equal(app.state().lastSelected,app.run('hit(890,560).id'))
const first=app.state().lastSelected
app.advance(2000)
app.world(890,560)
assert.equal(app.state().transformed,1,'Already converted buildings do not restart or revert')
app.world(200,200)
assert.equal(app.state().transformed,1,'Sky clicks do not affect another building')
app.world(1000,850)
assert.equal(app.state().transformed,2)
assert.notEqual(app.state().lastSelected,first)
assert.equal(app.state().lastSelected,app.run('hit(1000,850).id'))
assert.equal(app.run('regions.filter(r=>r.pieces.length).length'),2)
app.world(1300,1130,{button:2})
assert.equal(app.state().transformed,2)
app.world(1300,1130,{pointerType:'touch'})
assert.equal(app.state().transformed,3)
console.log('✓ Only the clicked building changes; sky and secondary clicks are ignored; touch works')

assert.ok(app.run('regions.filter(r=>r.pieces.length).every(r=>Math.abs(r.pieces.reduce((n,p)=>n+p.w*p.h,0)-r.w*r.h)<.001)'))
assert.ok(app.run('new Set(regions.flatMap(r=>r.pieces.map(p=>p.w.toFixed(2)))).size>8'))
assert.ok(app.run('new Set(regions.flatMap(r=>r.pieces.map(p=>p.h.toFixed(2)))).size>8'))
assert.ok(app.run('regions.every(r=>r.pieces.every(p=>colors.includes(p.color)&&p.sw>0&&p.sh>0&&Number.isFinite(p.dx)&&Number.isFinite(p.dy)))'))
app.advance(100000)
assert.equal(app.state().transformed,3)
const settled=app.requested;app.advance(1000);assert.equal(app.requested,settled)
console.log('✓ Blocks have varied random widths and heights, bright colors, and permanent settled states')

const restored=setup(app.storage)
assert.equal(restored.state().transformed,3)
assert.deepEqual([...restored.state().selected].sort(),[...app.state().selected].sort())
assert.equal(restored.run('JSON.stringify(regions.find(r=>r.pieces.length).pieces)'),app.run('JSON.stringify(regions.find(r=>r.pieces.length).pieces)'))
console.log('✓ Refresh restores the same transformed buildings, colors, and geometry')

app.run('for(let y=8;y<height;y+=18)for(let x=8;x<width;x+=18)activate(x,y)')
assert.equal(app.state().complete,true)
assert.ok(app.state().visible.every(id=>app.state().selected.includes(id)))
app.advance(5000)
assert.equal(app.run('mosaic.reduce((n,p)=>n+p.w*p.h,0)'),1670*1280)
assert.ok(app.run('new Set(mosaic.map(p=>p.w.toFixed(1))).size>20'))
const total=app.state().transformed;app.world(500,800);assert.equal(app.state().transformed,total)
const finalReload=setup(app.storage)
assert.equal(finalReload.state().complete,true)
assert.equal(finalReload.run('finalAt'),-10000,'Completed mosaic is restored immediately without returning to the photo')
console.log('✓ Converting all visible buildings fills the entire screen with solid boxes and remains complete after refresh')

for(const [w,h]of [[390,844],[320,568],[844,390],[2560,1080]]){
 const mobile=setup(new Map(),w,h)
 const st=mobile.state()
 assert.ok(st.scale*1670>=w&&st.scale*1280>=h)
 mobile.click(w*.5,h*.7,{pointerType:'touch'})
 assert.equal(mobile.state().transformed,1)
 const before=mobile.state().transformed
 mobile.sandbox.innerWidth=h;mobile.sandbox.innerHeight=w;mobile.globals.get('resize')()
 assert.equal(mobile.state().transformed,before)
 mobile.events.get('keydown')({key:'Enter',repeat:false,preventDefault(){}})
 assert.equal(mobile.state().transformed,before+1)
 mobile.preference.matches=true;mobile.advance(1000)
}
console.log('✓ Touch targeting, keyboard access, reduced motion, and resized layouts preserve state')
