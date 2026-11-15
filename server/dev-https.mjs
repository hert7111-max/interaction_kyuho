import {networkInterfaces} from 'node:os'
import {resolve} from 'node:path'
import {readFile} from 'node:fs/promises'
import {X509Certificate,createPrivateKey} from 'node:crypto'
export function localIPv4(interfaces=networkInterfaces()){
  return [...new Set(Object.values(interfaces).flat().filter(item=>item&&(item.family==='IPv4'||item.family===4)&&!item.internal&&!item.address.startsWith('169.254.')).map(item=>item.address))].sort()
}
export function httpsPaths(root){
  const directory=resolve(root,'.certs')
  return {directory,key:resolve(directory,'dev-key.pem'),cert:resolve(directory,'dev-cert.pem'),caDirectory:resolve(directory,'ca'),caCert:resolve(directory,'ca/rootCA.pem'),shareDirectory:resolve(directory,'share'),shareCert:resolve(directory,'share/rootCA.pem')}
}
export function validDevelopmentCertificate(cert,key,addresses=localIPv4(),now=Date.now()){
  try{
    const certificate=new X509Certificate(cert)
    return Date.parse(certificate.validFrom)<=now&&Date.parse(certificate.validTo)>now+7*86400000&&
      Boolean(certificate.checkHost('localhost'))&&['127.0.0.1','::1',...addresses].every(ip=>Boolean(certificate.checkIP(ip)))&&certificate.checkPrivateKey(createPrivateKey(key))
  }catch{return false}
}
export async function loadDevelopmentTLS(root){
  const paths=httpsPaths(root)
  try{
    const [key,cert]=await Promise.all([readFile(paths.key),readFile(paths.cert)])
    if(!validDevelopmentCertificate(cert,key))throw new Error('Certificate missing an address or expired')
    return {key,cert}
  }catch{throw new Error('개발용 HTTPS 인증서가 없거나 현재 IP와 맞지 않습니다. npm run setup:https를 먼저 실행해주세요.')}
}
export function protectedDevelopmentPath(pathname){
  const path=pathname.replaceAll('\\','/')
  return path.split('/').some(part=>part.toLowerCase()==='.certs'||part.toLowerCase()==='.dev-tools')||/\.(?:pem|key|crt)$/i.test(path)
}
