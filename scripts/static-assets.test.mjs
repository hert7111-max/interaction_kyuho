import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {gzipSync,brotliCompressSync,gunzipSync,brotliDecompressSync} from 'node:zlib'
import {acceptedEncodings,readAsset} from '../server/static-assets.mjs'
test('Compression negotiation respects q=0, client order preferences and absent support',()=>{
  assert.deepEqual(acceptedEncodings('gzip;q=1, br;q=.5'),['gzip','br'])
  assert.deepEqual(acceptedEncodings('gzip, br'),['br','gzip'])
  assert.deepEqual(acceptedEncodings('gzip;q=0, br;q=0'),[])
  assert.deepEqual(acceptedEncodings(''),[])
})
test('Brotli/gzip payloads decompress to identical originals, with raw fallbacks',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'papa-compression-'))
  try{
    const path=join(directory,'scene.js'),original=Buffer.from('const effect="rainbow";'.repeat(200))
    await writeFile(path,original);await writeFile(path+'.gz',gzipSync(original));await writeFile(path+'.br',brotliCompressSync(original))
    assert.deepEqual(brotliDecompressSync((await readAsset(path,'br,gzip')).data),original)
    assert.deepEqual(gunzipSync((await readAsset(path,'gzip')).data),original)
    assert.deepEqual((await readAsset(path,'identity')).data,original)
    assert.equal(await readAsset(path+'missing','br,gzip'),null)
  }finally{await rm(directory,{recursive:true,force:true})}
})
