import * as THREE from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
const shared=new Map<string,THREE.MeshStandardMaterial>()
const material=(color:string,roughness=.8,metalness=0)=>{const key=`${color}:${roughness}:${metalness}`;let m=shared.get(key);if(!m){m=new THREE.MeshStandardMaterial({color,roughness,metalness});shared.set(key,m)}return m}
function block(g:THREE.Group,w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number,round=0){const mesh=new THREE.Mesh(round?new RoundedBoxGeometry(w,h,d,2,Math.min(round,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh}
function cylinder(g:THREE.Group,top:number,bottom:number,h:number,m:THREE.Material,x:number,y:number,z:number,segments=18){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,segments),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh}
function texture(w:number,h:number,draw:(c:CanvasRenderingContext2D)=>void){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d')!);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;return t}
function label(text:string,bg:string,fg:string){return texture(256,256,c=>{c.fillStyle=bg;c.fillRect(0,0,256,256);c.fillStyle=fg;c.textAlign='center';c.font='italic bold 54px sans-serif';c.translate(128,128);c.rotate(-.10);c.fillText(text,0,10);c.font='16px monospace';c.fillText('ORIGINAL  /  2001',0,46);for(let i=0;i<12;i++){c.fillStyle=i%2?'#ffffff18':'#00000014';c.fillRect(-128,i*24-128,256,8)}})}
function tableLabel(g:THREE.Group,w:number,h:number,x:number,y:number,z:number,t:THREE.Texture,angle=0){const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.65}));p.rotation.set(-Math.PI/2,0,angle);p.position.set(x,y,z);p.receiveShadow=true;g.add(p);return p}
export function detailedRoom(){
  const g=new THREE.Group(),plaster=material('#8b7b68'),trim=material('#393f47'),metal=material('#3f4249',.45,.4),woodTexture=texture(256,128,c=>{
    c.fillStyle='#a66a43';c.fillRect(0,0,256,128)
    for(let i=0;i<800;i++){const y=(i*17.37)%128,x=(i*37.31)%256;c.fillStyle=i%3?'#512e1c18':'#f2ca8e20';c.fillRect(x,y,15+(i*19)%90,.5+(i%3)*.2)}
  });woodTexture.wrapS=woodTexture.wrapT=THREE.RepeatWrapping;woodTexture.repeat.set(2,1.5)
  const wood=new THREE.MeshStandardMaterial({map:woodTexture,color:'#c6a087',roughness:.5})
  // Solid wall sections leave real window openings and visible reveals.
  block(g,5.25,7,.20,plaster,0,2.0,-3.2);for(const s of [-1,1]){block(g,.55,7,.20,plaster,s*4.78,2,-3.2);block(g,2.2,2.2,.20,plaster,s*3.58,5.05,-3.2);block(g,2.2,2.8,.20,plaster,s*3.58,-.18,-3.2)}
  block(g,2.2,3.05,.20,plaster,3.58,2.52,-3.2)
  block(g,.18,7,14,material('#646b72'),-5,2,2.5);block(g,.18,7,14,material('#695d66'),5,2,2.5);block(g,10,.15,14,material('#333a48'),0,5.9,2.5)
  for(const s of [-1,1]){block(g,.08,.14,13.9,trim,s*4.88,-1.72,2.5);block(g,4.9,.12,.08,trim,s*2.5,-1.72,-3.05)}
  const weave=texture(128,128,c=>{c.fillStyle='#34274c';c.fillRect(0,0,128,128);for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2){const n=Math.sin(x*83+y*137)*.5+.5;c.fillStyle=`rgba(${70+n*40},${45+n*25},${105+n*40},.35)`;c.fillRect(x,y,1.2,1.7)}});weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(16,18)
  const carpet=new THREE.MeshStandardMaterial({map:weave,color:'#b69ac6',roughness:1});block(g,12,.10,17,carpet,0,-1.86,3)
  // A thick timber top, rounded front edge and metal legs are visible in perspective.
  block(g,9,.22,5.05,wood,0,-.12,-.4,.06);block(g,9,.065,.07,material('#bd8d60'),0,-.025,2.115,.02)
  for(const x of [-4.15,4.15])for(const z of [-2.45,1.65]){block(g,.14,1.7,.14,metal,x,-.99,z,.025);block(g,.26,.05,.24,trim,x,-1.79,z,.02)}
  block(g,8.4,.12,.12,metal,0,-1.48,-2.4,.025)
  windowRoom(g,-3.58,trim)
  memoryBoard(g)
  // Bookshelf and game cases provide real foreground/background overlap.
  const shelf=new THREE.Group();shelf.position.set(5.45,-.05,-2.05);shelf.rotation.y=-Math.PI/2;g.add(shelf)
  for(const x of [-.58,.58])block(shelf,.10,2.65,.65,material('#665044'),x,.55,0,.015)
  for(const y of [-.78,-.02,.74,1.74])block(shelf,1.26,.08,.69,material('#826550'),0,y,0,.015)
  const bookColors=['#7e384c','#3c696b','#af9a6b','#424e75','#8d6750']
  for(let i=0;i<11;i++){const book=block(shelf,.075+(i%3)*.015,.48+(i%4)*.06,.42,material(bookColors[i%5]!),-.49+i*.09,.28,-.02,.006);book.rotation.z=i>7?.08:0;block(shelf,.045,.015,.015,material('#c2b39c'),-.49+i*.09,.4,.199)}
  for(let i=0;i<3;i++){const book=block(shelf,.83,.09,.46,material(bookColors[i]!),.04,.86+i*.095,0,.008);book.rotation.y=(i-1)*.06}
  const wallArt=new THREE.Group();wallArt.position.set(-4.88,2.4,.35);wallArt.rotation.y=Math.PI/2;g.add(wallArt)
  block(wallArt,1.16,1.58,.06,trim,0,0,0,.02)
  const wallPrint=new THREE.Mesh(new THREE.PlaneGeometry(1.04,1.46),new THREE.MeshStandardMaterial({map:label('SATURN','#665369','#dfc399'),roughness:1}));wallPrint.position.z=.035;wallArt.add(wallPrint)
  // Desk speakers with cone recesses and metallic rings.
  for(const x of [-2.45,2.45]){
    block(g,.43,.88,.44,material('#31383d'),x,.43,-.72,.04)
    for(const y of [.28,.66]){const ring=new THREE.Mesh(new THREE.TorusGeometry(y>.5?.102:.145,.012,5,20),metal);ring.position.set(x,y,-.482);g.add(ring);const speaker=new THREE.Mesh(new THREE.CylinderGeometry(y>.5?.091:.132,y>.5?.07:.10,.035,18),material('#182029'));speaker.rotation.x=Math.PI/2;speaker.position.set(x,y,-.48);g.add(speaker)}
  }
  // A gray optical-disc console, memory-card slots and vents.
  const console=new THREE.Group();console.position.set(-2.9,.04,.53);console.rotation.y=.11;g.add(console)
  block(console,1.72,.29,1.1,material('#b9bab6'),0,.12,0,.08);cylinder(console,.60,.60,.035,material('#a4a8a8'),0,.285,-.04,36)
  for(const x of [-.60,.60]){cylinder(console,.09,.09,.025,material('#8b9291'),x,.284,.29,18);block(console,.27,.065,.03,trim,x*.54,.12,.555,.01);block(console,.23,.045,.04,material('#686e72'),x*.54,.22,.56,.005)}
  for(let i=0;i<8;i++)block(console,.015,.008,.29,trim,-.68+i*.04,.272,-.18)
  const led=new THREE.MeshBasicMaterial({color:'#72d69c'});block(console,.027,.016,.016,led,-.62,.16,.565)
  // CD jewel cases, snacks, can, mug, remote and loose game discs.
  for(let i=0;i<7;i++){const angle=-.07+i*.025,caseGroup=new THREE.Group();caseGroup.position.set(-2.87,.025+i*.06,-.9);caseGroup.rotation.y=angle;g.add(caseGroup);block(caseGroup,1.05,.055,.85,material(i%2?'#2d3442':'#323537',.3),0,0,0,.015);tableLabel(caseGroup,.97,.76,0,.030,0,label(i===6?'SKY RAID':'ARCADE',i===6?'#473557':'#25485d','#d8bda2'))}
  const pot=material('#9c5740');cylinder(g,.22,.17,.37,pot,-2.85,.20,-1.95);cylinder(g,.225,.225,.07,pot,-2.85,.37,-1.95)
  const cactus=new THREE.Mesh(new THREE.CapsuleGeometry(.125,.48,4,12),material('#496955'));cactus.position.set(-2.85,.71,-1.95);g.add(cactus)
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const rib=new THREE.Mesh(new THREE.CapsuleGeometry(.012,.48,3,6),material('#77916e'));rib.position.set(-2.85+Math.cos(a)*.12,.71,-1.95+Math.sin(a)*.12);g.add(rib)}
  const canGroup=new THREE.Group();canGroup.position.set(-3.72,0,-.45);g.add(canGroup)
  const canBody=new THREE.MeshStandardMaterial({map:label('COLA','#a22b3b','#fae1d4'),roughness:.38,metalness:.35});cylinder(canGroup,.135,.135,.53,canBody,0,.275,0,24);cylinder(canGroup,.127,.127,.018,material('#a8adb1',.25,.85),0,.545,0,24);cylinder(canGroup,.13,.13,.018,metal,0,.012,0,24);block(canGroup,.045,.008,.07,metal,0,.56,.015,.008)
  for(const [x,z,color,name,rotation]of [[2.97,1.45,'#b74632','CHIPS',.15],[-3.5,1.27,'#36755d','BYTE',-.22]] as const){const bag=new THREE.Group();bag.position.set(x,.13,z);bag.rotation.y=rotation;g.add(bag);block(bag,.74,.23,.61,material(color,.65),0,0,0,.08);tableLabel(bag,.65,.51,0,.125,0,label(name,color,'#f1d17b'));for(const edge of [-1,1])block(bag,.69,.025,.06,material('#ceb781'),0,0,edge*.32,.012)}
  const mug=cylinder(g,.19,.14,.40,material('#658787',.32),-1.93,.205,1.12,20);mug.rotation.z=.025
  const coffee=new THREE.Mesh(new THREE.CircleGeometry(.164,24),material('#30251e',.35));coffee.rotation.x=-Math.PI/2;coffee.position.set(-1.93,.408,1.12);g.add(coffee)
  const mugHandle=new THREE.Mesh(new THREE.TorusGeometry(.14,.037,8,16),material('#658787',.32));mugHandle.position.set(-2.125,.23,1.12);g.add(mugHandle)
  const remote=block(g,.24,.06,.65,trim,3.74,.04,.13,.04);remote.rotation.y=-.3
  for(let i=0;i<8;i++)block(g,.04,.014,.04,material(i?'#758087':'#ac4b52'),3.69+(i%2)*.08,.081,-.09+Math.floor(i/2)*.10,.007)
  // Warm desk lamp and pools of contact shadow enrich the sense of depth.
  const lamp=material('#874329',.45,.2);cylinder(g,.32,.34,.07,lamp,3.75,.035,-.65,24);cylinder(g,.035,.035,1.85,metal,3.75,.96,-.65,12)
  const shade=new THREE.Mesh(new THREE.ConeGeometry(.53,.48,24,1,true),new THREE.MeshStandardMaterial({color:'#aa5030',side:THREE.DoubleSide,roughness:.55}));shade.position.set(3.75,2.05,-.65);shade.rotation.z=-.15;g.add(shade)
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.105,12,8),new THREE.MeshBasicMaterial({color:'#ffe4b9'}));bulb.position.set(3.75,1.88,-.65);g.add(bulb)
  const light=new THREE.PointLight('#ffbc7b',13,6,2);light.position.set(3.71,1.85,-.58);g.add(light)
  // A framed print and molding give the wall surface physical depth.
  const poster=new THREE.Group();poster.position.set(-1.95,3.65,-3.01);poster.rotation.z=.045;g.add(poster);block(poster,1.07,1.43,.045,trim,0,0,0,.015)
  const image=new THREE.Mesh(new THREE.PlaneGeometry(.96,1.32),new THREE.MeshStandardMaterial({map:label('ORBIT','#33465c','#e5b584'),roughness:1}));image.position.z=.027;poster.add(image)
  return g
}
function windowRoom(g:THREE.Group,x:number,trim:THREE.Material){
  const group=new THREE.Group();group.position.set(x,2.6,-3.08);g.add(group)
  const frame=material('#b4b4ad',.75)
  for(const s of [-1,1]){block(group,.15,2.96,.34,frame,s*.96,0,0,.018);block(group,2.06,.14,.34,frame,0,s*1.45,0,.018)}
  for(const bx of [-.45,.45])block(group,.045,2.77,.085,trim,bx,0,.11,.005)
  block(group,1.92,.055,.085,trim,0,0,.11,.005);block(group,2.22,.13,.65,frame,0,-1.54,.12,.025)
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(1.8,2.73),new THREE.MeshStandardMaterial({color:'#b0c6cf',transparent:true,opacity:.11,roughness:.18,metalness:.15,depthWrite:false}));glass.position.z=.08;group.add(glass)
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,2.65,12),trim);rod.rotation.z=Math.PI/2;rod.position.set(0,1.69,.24);group.add(rod)
  const curtain=material('#716a7c',.95)
  for(const side of [-1,1]){
    const geometry=new THREE.PlaneGeometry(.44,3.12,12,12),pos=geometry.getAttribute('position')
    for(let i=0;i<pos.count;i++){const px=pos.getX(i),py=pos.getY(i);pos.setZ(i,Math.sin((px+.22)/.44*Math.PI*6)*.055+.04*Math.sin(py*1.5))}geometry.computeVertexNormals()
    const cloth=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#797084',roughness:1,side:THREE.DoubleSide}));cloth.position.set(side*1.22,-.03,.30);cloth.castShadow=true;group.add(cloth)
    for(let i=0;i<4;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.048,.008,5,10),curtain);ring.position.set(side*(1.08+i*.085),1.62,.25);group.add(ring)}
  }
  const sky=texture(16,128,c=>{const grad=c.createLinearGradient(0,0,0,128);grad.addColorStop(0,'#1c2949');grad.addColorStop(.6,'#76546f');grad.addColorStop(1,'#d28b75');c.fillStyle=grad;c.fillRect(0,0,16,128)})
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(8,9),new THREE.MeshBasicMaterial({map:sky}));backdrop.position.set(0,0,-5);group.add(backdrop)
  for(let i=0;i<7;i++){
    const bx=-2.8+i*.85,by=-2+(i*1.7)%1.4,z=-1.0-(i%3)*.85,h=1.9+(i%4)*.5
    block(group,.7,h,.68,material(i%2?'#2e3c52':'#3b4357'),bx,by,z)
    const lit=new THREE.MeshBasicMaterial({color:i%2?'#d0a570':'#8bacc0'})
    for(let row=0;row<6;row++)for(let col=0;col<2;col++)if((row+i+col)%4!==0)block(group,.08,.11,.012,lit,bx-.17+col*.28,by+h*.36-row*.23,z+.349)
  }
}
function memoryBoard(g:THREE.Group){
 const board=new THREE.Group();board.position.set(3.28,2.35,-3.02);g.add(board)
 block(board,3.05,3.05,.11,material('#71503b'),0,0,0,.025)
 const cork=texture(256,256,c=>{c.fillStyle='#967046';c.fillRect(0,0,256,256);for(let i=0;i<6500;i++){c.fillStyle=i%2?'#cfad7355':'#51382450';c.fillRect((i*37.1)%256,(i*91.7)%256,1+(i%3),1+(i%2))}})
 const face=new THREE.Mesh(new THREE.PlaneGeometry(2.91,2.91),new THREE.MeshStandardMaterial({map:cork,roughness:1}));face.position.z=.061;board.add(face)
 for(let i=0;i<7;i++){
  const note=new THREE.Group();note.position.set(-1.03+(i%3)*.52,.95-Math.floor(i/3)*.47,.085);note.rotation.z=(i%2?1:-1)*(.06+i*.012);board.add(note)
  block(note,.43,.34,.008,material(['#b7bca6','#c2a2a5','#b0bbbd','#c1b184'][i%4]!),0,0,0)
  for(let line=0;line<4;line++)block(note,.27-(line%2)*.05,.008,.003,material('#626e6d'),-.02,.09-line*.043,.007)
  const pin=new THREE.Mesh(new THREE.SphereGeometry(.022,7,5),material('#70443b'));pin.position.set(0,.14,.025);note.add(pin)
 }
 for(let i=0;i<3;i++){
  const photo=new THREE.Group();photo.position.set(i===1?.55:.27,.78-i*.84,.11+i*.003);photo.rotation.z=(i%2?1:-1)*.09;board.add(photo);block(photo,1.14,.75,.012,material('#bfb6a3'),0,0,0)
  const picture=texture(256,160,c=>{
   const gradient=c.createLinearGradient(0,0,0,160);gradient.addColorStop(0,i===0?'#475475':'#738592');gradient.addColorStop(.6,i===2?'#c19c72':'#a9b0a1');gradient.addColorStop(1,'#373f45');c.fillStyle=gradient;c.fillRect(0,0,256,160)
   for(let layer=0;layer<3;layer++){c.fillStyle=['#526268','#354953','#28353b'][layer]!;c.beginPath();c.moveTo(0,160);for(let x=0;x<=256;x+=8)c.lineTo(x,80+layer*21+Math.sin(x*.025+layer+i)*18+Math.sin(x*.07+i)*9);c.lineTo(256,160);c.fill()}
   if(i===0){for(let j=0;j<11;j++){const x=j*24;c.fillStyle='#252f40';c.fillRect(x,70+(j*13)%25,15,80);c.fillStyle='#d0b47a';c.fillRect(x+5,85+(j*13)%25,3,5)}}
  })
  const print=new THREE.Mesh(new THREE.PlaneGeometry(1.04,.61),new THREE.MeshStandardMaterial({map:picture,roughness:1}));print.position.set(0,.025,.009);photo.add(print)
 }
}
