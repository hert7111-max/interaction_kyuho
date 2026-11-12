import { PERSON_VARIANTS } from './papa-game'
type Point={x:number;y:number}
const skins=['#e2b492','#b87854','#78513c','#efc3a2','#b58b68','#5f4032','#d7a47b','#956347','#f0c8af','#a77358','#d8b491','#6f4d3d']
const shirts=['#3f607f','#9b3345','#d4c8b1','#353c48','#528585','#d87732','#ddd9ce','#3e6c97','#78628a','#68794e','#ac9470','#576174']
const trousers=['#273340','#303b51','#373348','#28262f','#254e55','#354252','#495a71','#293d57','#42344a','#343b31','#4a3b32','#302c35']
const hairs=['#2a2424','#472a21','#181b21','#b38b4f','#251e1b','#151719','#8f4b2b','#242124','#60412d','#151b22','#4a3127','#27202a']
const hex=(value:string,amount:number)=>{const n=parseInt(value.slice(1),16),clamp=(n:number)=>Math.max(0,Math.min(255,Math.round(n)));return `rgb(${clamp((n>>16)+amount)},${clamp(((n>>8)&255)+amount)},${clamp((n&255)+amount)})`}
/** Adult anatomy: 15px head, 120px crown-to-sole height (8 heads), before pose flexion. */
export class HumanSprites{
  readonly atlas:HTMLCanvasElement
  readonly tileWidth=80
  readonly tileHeight=176
  constructor(){
    this.atlas=document.createElement('canvas');this.atlas.width=this.tileWidth*12;this.atlas.height=this.tileHeight*PERSON_VARIANTS
    const ctx=this.atlas.getContext('2d')!
    for(let variant=0;variant<PERSON_VARIANTS;variant++)for(let frame=0;frame<12;frame++){
      ctx.save();ctx.translate(frame*this.tileWidth,variant*this.tileHeight);this.draw(ctx,variant,frame);ctx.restore()
    }
  }
  drawFrame(ctx:CanvasRenderingContext2D,variant:number,frame:number){ctx.drawImage(this.atlas,frame*80,variant*176,80,176,-36,-79.2,72,158.4)}
  private draw(ctx:CanvasRenderingContext2D,variant:number,frame:number){
    const skin=skins[variant]!,shirt=shirts[variant]!,pants=trousers[variant]!,hair=hairs[variant]!,outline='#18202a'
    const woman=[1,2,4,6,8,10].includes(variant),fall=frame>=8,phase=(frame%8)/8*Math.PI*2,flail=(frame-8)/4*Math.PI*2
    const light=hex(shirt,30),dark=hex(shirt,-26),skinLight=hex(skin,22),skinDark=hex(skin,-31)
    const poly=(points:Point[],fill:string,stroke?:string)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.85;ctx.stroke()}}
    const line=(points:Point[],color:string,width=1)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
    const rect=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
    const segment=(a:Point,b:Point,wa:number,wb:number,base:string)=>{
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length
      const p=(v:Point,w:number)=>({x:v.x+nx*w,y:v.y+ny*w})
      poly([p(a,wa/2),p(b,wb/2),p(b,-wb/2),p(a,-wa/2)],base,outline)
      poly([p(a,wa/2-.5),p(b,wb/2-.5),p(b,wb*.13),p(a,wa*.13)],hex(base,20))
      poly([p(a,-wa/2+.5),p(b,-wb/2+.5),p(b,-wb*.21),p(a,-wa*.21)],hex(base,-26))
    }
    ctx.lineCap='round';ctx.lineJoin='bevel'
    const leftHip={x:woman?35:34,y:88},rightHip={x:woman?45:46,y:88}
    const gait=Math.sin(phase),opposite=Math.sin(phase+Math.PI)
    const knees=[{x:fall?25+Math.cos(flail)*8:24+gait*4,y:fall?111:110+gait*8},{x:fall?54-Math.sin(flail)*7:56+opposite*4,y:fall?108:110+opposite*8}]
    const ankles=[{x:fall?20+Math.sin(flail)*8:29+gait*5,y:fall?135:140+gait*8},{x:fall?59+Math.cos(flail)*9:51+opposite*5,y:fall?137:140+opposite*8}]
    // Long thighs and calves, tapered trouser legs, boots and articulated knees.
    for(let side=0;side<2;side++){
      const hip=side?rightHip:leftHip,knee=knees[side]!,ankle=ankles[side]!
      segment(hip,knee,woman?8:10,7,pants);segment(knee,ankle,7,5.5,pants)
      line([{x:knee.x-2,y:knee.y-3},{x:knee.x+2,y:knee.y-1}],hex(pants,32),1)
      line([{x:knee.x+(side?1:-1),y:knee.y+5},{x:ankle.x+1,y:ankle.y-5}],hex(pants,24),.7)
      poly([{x:ankle.x-3,y:ankle.y-2},{x:ankle.x+3,y:ankle.y-2},{x:ankle.x+5,y:ankle.y+5},{x:ankle.x-6,y:ankle.y+6},{x:ankle.x-6,y:ankle.y+2}],variant===10?'#533b2e':'#22262e',outline)
      line([{x:ankle.x-5,y:ankle.y+5},{x:ankle.x+4,y:ankle.y+4}],'#888b8b',.8)
      rect(ankle.x-2,ankle.y,4,1,'#6d6b68')
    }
    // The shoulder/elbow/wrist chain alternates a high grip and a bent supporting arm.
    const shoulders=[{x:woman?29:27,y:51},{x:woman?51:53,y:51}]
    const elbows=fall?[{x:17+Math.sin(flail)*5,y:51+Math.cos(flail)*8},{x:65+Math.cos(flail)*5,y:45-Math.sin(flail)*8}]:[{x:17,y:42+gait*14},{x:63,y:42+opposite*14}]
    const wrists=fall?[{x:9,y:30+Math.sin(flail)*16},{x:73,y:31+Math.cos(flail)*15}]:[{x:18+gait*3,y:19+gait*14},{x:62+opposite*3,y:19+opposite*14}]
    for(let side=0;side<2;side++){
      const shoulder=shoulders[side]!,elbow=elbows[side]!,wrist=wrists[side]!,short=[4,7,9].includes(variant)
      segment(shoulder,elbow,8,6,shirt);segment(elbow,wrist,short?5.5:6,4,short?skin:shirt)
      line([{x:elbow.x-2,y:elbow.y-2},{x:elbow.x+2,y:elbow.y+1}],short?skinDark:dark,1)
      segment({x:wrist.x,y:wrist.y+1},{x:wrist.x,y:wrist.y-5},4.8,4,skin)
      line([{x:wrist.x-2,y:wrist.y-2},{x:wrist.x-3,y:wrist.y-6}],skinDark,.8)
      for(let finger=0;finger<3;finger++)line([{x:wrist.x-1+finger,y:wrist.y-4},{x:wrist.x-1+finger,y:wrist.y-7}],skinLight,.6)
      if(!short)line([{x:wrist.x-2,y:wrist.y+3},{x:wrist.x+2,y:wrist.y+3}],light,1)
    }
    // Shoulder-to-pelvis clothing follows an adult torso, with a narrow waist and natural hips.
    poly([{x:woman?30:27,y:48},{x:36,y:46},{x:44,y:46},{x:woman?50:53,y:48},{x:woman?49:51,y:66},{x:woman?46:49,y:79},{x:woman?50:50,y:90},{x:woman?30:30,y:90},{x:woman?34:31,y:79},{x:woman?31:29,y:64}],shirt,outline)
    poly([{x:29,y:51},{x:34,y:50},{x:35,y:76},{x:33,y:86},{x:30,y:86}],light)
    poly([{x:48,y:51},{x:51,y:51},{x:48,y:76},{x:49,y:87},{x:45,y:86}],dark)
    line([{x:32,y:63},{x:37,y:66},{x:40,y:64}],dark,.8)
    line([{x:41,y:70},{x:47,y:68}],light,.8)
    rect(31,86,18,3,'#292a2c');rect(38,86,4,3,'#a6a394')
    // Twelve costume palettes, including tailored jackets, shirts, sportswear, workwear and coats.
    if(variant===0||variant===3){
      poly([{x:35,y:47},{x:40,y:52},{x:45,y:47},{x:43,y:77},{x:37,y:77}],'#dce1df')
      poly([{x:32,y:48},{x:36,y:60},{x:39,y:54},{x:35,y:47}],light);poly([{x:48,y:48},{x:44,y:60},{x:41,y:54},{x:45,y:47}],dark)
      poly([{x:39,y:51},{x:41,y:51},{x:42,y:70},{x:40,y:74},{x:38,y:70}],variant===0?'#8e3647':'#535a71')
      rect(30,59,5,1,'#c6c6c2');rect(45,74,4,1,light);rect(31,76,5,1,dark)
    }else if(variant===1||variant===8){
      poly([{x:34,y:47},{x:40,y:55},{x:46,y:47},{x:43,y:65},{x:37,y:65}],hex(shirt,-37))
      line([{x:39,y:56},{x:39,y:85}],hex(shirt,55),1);rect(40,65,2,2,'#b9ad9a');rect(40,75,2,2,'#b9ad9a')
      line([{x:31,y:72},{x:36,y:74}],dark,1);line([{x:44,y:74},{x:49,y:72}],light,1)
    }else if(variant===2||variant===10){
      poly([{x:32,y:51},{x:39,y:60},{x:36,y:76},{x:29,y:103},{x:38,y:103},{x:40,y:88},{x:43,y:103},{x:52,y:102},{x:45,y:77},{x:42,y:58},{x:48,y:51}],shirt,outline)
      line([{x:40,y:59},{x:40,y:96}],dark,1);rect(30,78,20,2,hex(shirt,-36));rect(37,77,5,4,'#a89b7d');rect(32,91,5,1,dark);rect(44,91,5,1,dark)
    }else if(variant===4){
      poly([{x:35,y:48},{x:40,y:54},{x:45,y:48}],skinDark);rect(43,59,5,1,'#c6e2d9');rect(43,60,1,4,'#c6e2d9');rect(47,60,1,4,'#c6e2d9')
    }else if(variant===5){
      rect(32,51,3,34,'#e8d185');rect(45,51,3,34,'#e8d185');rect(30,68,20,3,'#e8d185');line([{x:40,y:49},{x:40,y:85}],'#713b25',1)
    }else if(variant===6){
      poly([{x:33,y:47},{x:39,y:52},{x:36,y:57}],light);poly([{x:47,y:47},{x:41,y:52},{x:44,y:57}],light);line([{x:40,y:54},{x:40,y:86}],'#a9a89f',.8);for(let y=60;y<85;y+=7)rect(40,y,1,1,'#575b60')
    }else if(variant===7){
      rect(36,58,2,15,'#dce4df');rect(42,58,2,15,'#dce4df');rect(36,58,8,2,'#dce4df');rect(36,65,8,2,'#dce4df');rect(36,71,8,2,'#dce4df');rect(29,51,3,10,'#dce4df');rect(48,51,3,10,'#dce4df')
    }else if(variant===9){
      rect(32,58,5,2,hex(shirt,-33));rect(44,58,5,2,hex(shirt,-33));line([{x:40,y:48},{x:40,y:85}],dark,1);rect(39,63,2,2,'#b1b5a4');rect(39,72,2,2,'#b1b5a4')
    }else{line([{x:35,y:48},{x:43,y:79}],'#92919b',2);line([{x:45,y:49},{x:38,y:80}],'#292932',1);rect(29,54,5,2,'#c8a9ba');rect(44,67,6,1,'#c2c1bf')}
    // A small 15px head, neck, planar cheek/jaw shading and restrained facial detail.
    segment({x:40,y:42},{x:40,y:49},6,7,skin)
    ctx.save();ctx.translate(0,43);ctx.scale(1,15/17);ctx.translate(0,-43)
    poly([{x:35,y:29},{x:43,y:28},{x:46,y:32},{x:45,y:39},{x:42,y:43},{x:37,y:42},{x:34,y:37}],skin,outline)
    poly([{x:43,y:31},{x:46,y:33},{x:44,y:40},{x:41,y:42},{x:41,y:36}],skinDark)
    poly([{x:35,y:31},{x:38,y:30},{x:38,y:37},{x:36,y:39}],skinLight)
    rect(33,34,2,4,skinDark);rect(45,34,2,4,skinDark)
    if(variant===2||variant===5){poly([{x:33,y:29},{x:35,y:26},{x:43,y:25},{x:47,y:29},{x:47,y:34},{x:44,y:32},{x:42,y:28},{x:35,y:32},{x:33,y:36}],hair);for(let i=0;i<4;i++)rect(34+i*3,26-(i%2),3,3,hair)}
    else if(woman){poly([{x:33,y:30},{x:36,y:26},{x:43,y:26},{x:47,y:30},{x:47,y:44},{x:44,y:47},{x:44,y:33},{x:39,y:29},{x:35,y:32},{x:35,y:45},{x:32,y:43}],hair);if(variant===1||variant===8){poly([{x:46,y:32},{x:50,y:35},{x:51,y:48},{x:48,y:52},{x:46,y:43}],hair);line([{x:48,y:36},{x:49,y:46}],hex(hair,27),.8)}}
    else{poly([{x:33,y:31},{x:34,y:27},{x:43,y:26},{x:46,y:30},{x:46,y:35},{x:43,y:32},{x:41,y:29},{x:34,y:32},{x:35,y:36},{x:33,y:36}],hair);line([{x:35,y:29},{x:42,y:28}],hex(hair,29),1)}
    rect(36,34,2,1,outline);rect(41,34,2,1,outline);rect(37,33,2,1,hex(hair,8));rect(41,33,2,1,hex(hair,8));rect(40,35,1,3,skinDark);rect(38,40,3,1,hex(skin,-52));rect(38,38,3,1,skinLight)
    if(variant===0||variant===9)line([{x:36,y:39},{x:38,y:42},{x:42,y:42},{x:44,y:38}],hex(hair,15),.7)
    if(variant===11){rect(35,34,4,2,'#242e37');rect(41,34,4,2,'#242e37');rect(39,34,2,1,'#303742')}
    if(variant===5){poly([{x:32,y:29},{x:34,y:25},{x:43,y:24},{x:47,y:27},{x:48,y:30}], '#d5a34c',outline);rect(31,29,18,2,'#e8b660');rect(39,25,2,4,'#f5d08c')}
    if(variant===7){poly([{x:33,y:29},{x:35,y:26},{x:43,y:26},{x:46,y:30}],hex(shirt,-12),outline);rect(36,30,14,2,shirt)}
    ctx.restore()
  }
}
