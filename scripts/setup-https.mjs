import {mkdir,readFile,writeFile,copyFile,chmod,rename,rm,access} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
import {X509Certificate} from 'node:crypto'
import {httpsPaths,localIPv4,validDevelopmentCertificate} from '../server/dev-https.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const release='v1.4.4'
async function findMkcert(){
  const system=process.env.MKCERT_BIN||'mkcert'
  const probe=spawnSync(system,['-version'],{encoding:'utf8',timeout:5000,windowsHide:true})
  if(!probe.error&&probe.status===0)return system
  if(process.env.MKCERT_BIN)throw new Error('MKCERT_BIN에 지정한 mkcert를 실행할 수 없습니다.')
  const executable=resolve(root,'.dev-tools',process.platform==='win32'?'mkcert.exe':'mkcert')
  try{await access(executable);return executable}catch{}
  const architecture={x64:'amd64',arm64:'arm64',arm:'arm'}[process.arch]
  const platform={darwin:'darwin',linux:'linux',win32:'windows'}[process.platform]
  if(!architecture||!platform)throw new Error('이 환경에는 mkcert를 직접 설치한 뒤 npm run setup:https를 실행해주세요.')
  const filename=`mkcert-${release}-${platform}-${architecture}${platform==='windows'?'.exe':''}`
  const url=`https://github.com/FiloSottile/mkcert/releases/download/${release}/${filename}`
  console.log(`mkcert ${release} 공식 배포본을 .dev-tools에 준비합니다.`)
  await mkdir(dirname(executable),{recursive:true,mode:0o700})
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)})
  if(!response.ok)throw new Error(`mkcert 다운로드 실패 (${response.status}). mkcert를 직접 설치할 수도 있습니다.`)
  const temporary=executable+(process.platform==='win32'?'.download.exe':'.download')
  try{
    await writeFile(temporary,Buffer.from(await response.arrayBuffer()),{mode:0o700})
    const verify=spawnSync(temporary,['-version'],{encoding:'utf8',timeout:5000,windowsHide:true})
    if(verify.status!==0||!verify.stdout.includes(release))throw new Error('다운로드한 mkcert 버전을 확인할 수 없습니다.')
    await rename(temporary,executable)
  }catch(error){await rm(temporary,{force:true});throw error}
  return executable
}
export async function prepareHttps({trust=false,force=false}={}){
  const paths=httpsPaths(root),addresses=localIPv4()
  await mkdir(paths.directory,{recursive:true,mode:0o700})
  await mkdir(paths.caDirectory,{recursive:true,mode:0o700})
  const mkcert=await findMkcert(),env={...process.env,CAROOT:paths.caDirectory}
  if(trust){
    const result=spawnSync(mkcert,['-install'],{env,stdio:'inherit',windowsHide:true})
    if(result.error)throw result.error
    if(result.status!==0)throw new Error('루트 인증서를 신뢰 저장소에 설치하지 못했습니다. 터미널에서 npm run trust:https를 실행하고 관리자 인증을 완료해주세요.')
  }
  let current=false
  try{
    const [cert,key,ca]=await Promise.all([readFile(paths.cert),readFile(paths.key),readFile(paths.caCert)])
    current=!force&&validDevelopmentCertificate(cert,key,addresses)&&new X509Certificate(cert).verify(new X509Certificate(ca).publicKey)
  }catch{}
  if(!current){
    const result=spawnSync(mkcert,['-cert-file',paths.cert,'-key-file',paths.key,'localhost','127.0.0.1','::1',...addresses],{env,stdio:'inherit',windowsHide:true})
    if(result.error)throw result.error
    if(result.status!==0)throw new Error('mkcert 개발 인증서 생성에 실패했습니다.')
  }
  await chmod(paths.key,0o600)
  await chmod(resolve(paths.caDirectory,'rootCA-key.pem'),0o600)
  await mkdir(paths.shareDirectory,{recursive:true,mode:0o700})
  await copyFile(paths.caCert,paths.shareCert)
  console.log(`HTTPS 인증서 준비 완료: localhost, 127.0.0.1, ::1${addresses.length?', '+addresses.join(', '):''}`)
  console.log('다른 PC에는 .certs/share/rootCA.pem만 전달해 신뢰된 루트 인증서로 설치하세요.')
  if(!trust)console.log('이 PC에서 최초 1회 신뢰 설정: npm run trust:https')
  return paths
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{await prepareHttps({trust:process.argv.includes('--trust'),force:process.argv.includes('--force')})}
  catch(error){console.error(error.message);process.exitCode=1}
}
