import { PERSON_VARIANTS } from './papa-game'
const skins=['#f2c9a6','#d9a178','#a66a4b','#71432f','#e8b992','#b37a58','#f1ceb0','#85563c','#cd956c','#57372b','#dfb99c','#b98268','#e4b694','#966043']
const tops=['#4685e9','#dc5274','#e2b940','#5bcaad','#925ce7','#e4763d','#e8e2d3','#47656e','#cd557c','#59a8d5','#d2bb8c','#a05db2','#61965c','#5664a9']
const bottoms=['#273b62','#343044','#4b4160','#234f55','#29243d','#314c67','#69778a','#424838','#313451','#364973','#4b3e40','#3f3151','#323b4f','#292939']
const hair=['#30252b','#5a3428','#201f27','#151d28','#d2a253','#2b2026','#a45137','#1d2029','#55312d','#1a202a','#443027','#2d2532','#824b32','#2c2529']
export class HumanSprites{
  private atlas:HTMLCanvasElement[][]=[]
  constructor(){for(let variant=0;variant<PERSON_VARIANTS;variant++){const poses:HTMLCanvasElement[]=[];for(let pose=0;pose<11;pose++)poses.push(this.make(variant,pose));this.atlas.push(poses)}}
  get(variant:number,pose:number){return this.atlas[variant%PERSON_VARIANTS]![Math.max(0,Math.min(10,pose))]!}
  private make(variant:number,pose:number){
    const canvas=document.createElement('canvas');canvas.width=52;canvas.height=90
    const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false
    const skin=skins[variant]!,shirt=tops[variant]!,pants=bottoms[variant]!,hairstyle=hair[variant]!,outline='#172131'
    const feminine=[1,3,4,8,10,11].includes(variant),fall=pose>=8,phase=pose/8*Math.PI*2
    const rect=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
    const limb=(points:number[][],color:string,width:number)=>{
      ctx.lineCap='square';ctx.lineJoin='bevel'
      for(const [stroke,size] of [[outline,width+2],[color,width]] as const){ctx.strokeStyle=stroke;ctx.lineWidth=size;ctx.beginPath();points.forEach(([x,y],i)=>{if(i)ctx.lineTo(Math.round(x!),Math.round(y!));else ctx.moveTo(Math.round(x!),Math.round(y!))});ctx.stroke()}
    }
    const reachL=fall?-7:Math.sin(phase)*12,reachR=fall?5:Math.sin(phase+Math.PI)*12
    const kneeL=fall?4:Math.sin(phase+Math.PI)*7,kneeR=fall?-3:Math.sin(phase)*7
    // Separate limbs form a climbing cycle, including bent elbows, knees and alternating grips.
    limb([[20,54],[14,65+kneeL],[17,79+kneeL*.4]],pants,6)
    limb([[32,54],[39,65+kneeR],[34,79+kneeR*.4]],pants,6)
    rect(11,77+kneeL*.4,10,5,'#172131');rect(31,77+kneeR*.4,10,5,'#172131')
    limb([[17,33],[8,31+reachL*.5],[8,18+reachL]],shirt,6)
    limb([[35,33],[44,31+reachR*.5],[44,18+reachR]],shirt,6)
    rect(5,14+reachL,6,7,skin);rect(41,14+reachR,6,7,skin)
    rect(15,29,22,29,outline);rect(17,30,18,25,shirt);rect(18,32,3,20,'#ffffff20');rect(32,32,3,22,'#1721312b')
    if(feminine&&[1,8,11].includes(variant)){ctx.fillStyle=shirt;ctx.beginPath();ctx.moveTo(18,43);ctx.lineTo(34,43);ctx.lineTo(40,61);ctx.lineTo(12,61);ctx.closePath();ctx.fill();rect(14,59,24,2,outline)}
    rect(23,24,7,8,skin)
    rect(17,9,19,19,outline);rect(18,10,17,16,skin);rect(18,12,3,12,'#ffffff17');rect(31,13,4,12,'#4c251626');rect(21,25,10,3,skin)
    // Hair, headwear and outfit details are independent of the actor's hit/physics logic.
    if(variant===9||variant===3){rect(15,5,23,9,hairstyle);rect(13,10,5,10,hairstyle);rect(35,9,4,12,hairstyle);rect(18,3,16,4,hairstyle)}
    else if(variant===11){rect(16,7,21,7,shirt);rect(15,12,5,20,shirt);rect(33,11,6,21,shirt);rect(18,27,17,6,shirt);rect(19,9,15,3,'#d5b8e1')}
    else{rect(17,7,19,7,hairstyle);rect(17,12,4,7,hairstyle);rect(31,11,5,8,hairstyle);if(feminine){rect(34,16,5,18,hairstyle);rect(15,16,4,16,hairstyle)}}
    rect(22,18,2,2,outline);rect(29,18,2,2,outline);rect(25,23,4,1,'#87504c')
    if(variant===0){rect(22,30,8,13,'#e8f3ff');rect(25,31,3,17,'#e34961');rect(21,54,12,3,'#1e2939')}
    if(variant===2){rect(24,30,2,24,'#725d2c');rect(19,40,5,4,'#ba953a');rect(29,40,4,4,'#ba953a');rect(15,6,23,7,'#e4b943');rect(18,3,16,5,'#f6d26b')}
    if(variant===4){rect(19,33,14,3,'#f2d3a4');rect(24,33,4,11,'#f2d3a4')}
    if(variant===5){rect(17,37,18,3,'#efdb98');rect(20,30,3,25,'#efdb98');rect(30,30,3,25,'#efdb98');rect(16,6,22,6,'#e67b39')}
    if(variant===6){rect(23,30,6,13,'#3e4a5c');rect(25,30,2,20,'#d9cbb6');rect(18,40,5,2,'#8d969d')}
    if(variant===7){rect(17,37,18,5,'#c2d2c1');rect(23,8,7,3,'#617d79')}
    if(variant===8){rect(19,37,14,3,'#f5c0d0');rect(21,47,10,3,'#f5c0d0')}
    if(variant===9){rect(22,35,3,12,'#eaf1f4');rect(28,35,3,12,'#eaf1f4');rect(24,35,5,3,'#eaf1f4');rect(22,44,9,3,'#eaf1f4')}
    if(variant===10){rect(24,30,2,25,'#8b7858');rect(20,38,3,2,'#8b7858');rect(29,38,3,2,'#8b7858');rect(18,49,17,2,'#8b7858')}
    if(variant===12){rect(16,6,21,5,'#4b7042');rect(13,10,27,3,'#354f33');rect(21,31,3,23,'#c3a36c')}
    if(variant===13){rect(21,19,6,3,'#102034');rect(29,19,6,3,'#102034');rect(25,20,5,1,'#102034');rect(22,32,8,3,'#d5a0b9')}
    return canvas
  }
}
