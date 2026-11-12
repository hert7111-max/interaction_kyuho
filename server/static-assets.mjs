import {readFile} from 'node:fs/promises'
export function acceptedEncodings(header=''){
  const entries=String(header).split(',').map(value=>{const [name,...parameters]=value.trim().toLowerCase().split(';'),q=parameters.find(p=>p.trim().startsWith('q='));return{name,q:q?Number(q.trim().slice(2)):1}})
  const quality=name=>entries.find(e=>e.name===name)?.q??entries.find(e=>e.name==='*')?.q??0
  return ['br','gzip'].map(name=>({name,q:quality(name)})).filter(e=>Number.isFinite(e.q)&&e.q>0).sort((a,b)=>b.q-a.q).map(e=>e.name)
}
export async function readAsset(file,accept=''){
  for(const encoding of acceptedEncodings(accept)){
    try{return{data:await readFile(file+(encoding==='br'?'.br':'.gz')),encoding}}catch{/* Uncompressed original remains valid. */}
  }
  try{return{data:await readFile(file),encoding:null}}catch{return null}
}
