import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile,stat} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {X509Certificate} from 'node:crypto'
import {createSecureContext} from 'node:tls'
import {localIPv4,httpsPaths,validDevelopmentCertificate,loadDevelopmentTLS,protectedDevelopmentPath} from '../server/dev-https.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),paths=httpsPaths(root)
test('LAN IP detection omits loopback and link-local, supports Node family formats, and deduplicates',()=>{
  assert.deepEqual(localIPv4({lo:[{address:'127.0.0.1',internal:true,family:'IPv4'}],a:[{address:'172.30.1.83',internal:false,family:'IPv4'},{address:'::1',internal:true,family:'IPv6'}],b:[{address:'172.30.1.83',internal:false,family:4},{address:'192.168.1.7',internal:false,family:'IPv4'},{address:'169.254.1.1',internal:false,family:'IPv4'}]}),['172.30.1.83','192.168.1.7'])
})
test('Certificates, CA, tools and absolute Vite file paths are never public routes',()=>{
  for(const path of ['/.certs/dev-key.pem','/.certs/ca/rootCA-key.pem','/.certs/share/rootCA.pem','/.CERTS/other','/.dev-tools/mkcert','/@fs/Users/me/app/.certs/dev-key.pem','/private.key','/certificate.CRT'])assert.equal(protectedDevelopmentPath(path),true,path)
  for(const path of ['/','/src/papa.ts','/public/papa-runtime.js','/mediapipe/wasm/vision_wasm_internal.wasm','/api/info'])assert.equal(protectedDevelopmentPath(path),false,path)
})
test('Missing TLS config fails clearly instead of silently starting HTTP',async()=>{
  await assert.rejects(loadDevelopmentTLS(resolve(root,'not-a-project')),/npm run setup:https/)
})
test('Generated mkcert certificate covers current IPs, key matches, and TLS context initializes without listening',{skip:!existsSync(paths.cert)},async()=>{
  const tls=await loadDevelopmentTLS(root),certificate=new X509Certificate(tls.cert),ca=new X509Certificate(await readFile(paths.caCert))
  assert.equal(validDevelopmentCertificate(tls.cert,tls.key),true)
  assert.equal(validDevelopmentCertificate(tls.cert,tls.key,['192.0.2.123']),false)
  assert.equal(validDevelopmentCertificate(tls.cert,'invalid-key'),false)
  assert.equal(validDevelopmentCertificate(tls.cert,tls.key,[],Date.parse(certificate.validTo)),false)
  assert.equal(certificate.verify(ca.publicKey),true)
  assert.ok(createSecureContext(tls))
  assert.deepEqual(await readFile(paths.shareCert),await readFile(paths.caCert))
  if(process.platform!=='win32')assert.equal((await stat(paths.key)).mode&0o777,0o600)
})
