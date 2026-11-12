import { readdir,readFile,writeFile } from 'node:fs/promises'
import { join,extname } from 'node:path'
import { promisify } from 'node:util'
import { gzip,brotliCompress,constants } from 'node:zlib'
const gz=promisify(gzip),br=promisify(brotliCompress)
const extensions=new Set(['.js','.css','.html','.svg','.json','.wasm','.task','.tflite','.ttf'])
let original=0,packed=0,count=0
async function visit(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name)
    if(entry.isDirectory()){await visit(path);continue}
    if(!extensions.has(extname(path)))continue
    const input=await readFile(path);if(input.length<512)continue
    const [gzip,brotli]=await Promise.all([gz(input,{level:9}),br(input,{params:{[constants.BROTLI_PARAM_QUALITY]:9}})])
    if(gzip.length<input.length*.97)await writeFile(path+'.gz',gzip)
    if(brotli.length<input.length*.97)await writeFile(path+'.br',brotli)
    original+=input.length;packed+=Math.min(input.length,gzip.length,brotli.length);count++
  }
}
await visit('dist')
console.log(`Lossless compression: ${count} assets, ${(original/1048576).toFixed(2)} → ${(packed/1048576).toFixed(2)} MiB (${(100*(1-packed/original)).toFixed(1)}% smaller, raw fallbacks retained).`)
