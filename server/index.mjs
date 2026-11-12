import { createServer } from 'node:http'
import { stat } from 'node:fs/promises'
import { resolve,dirname,extname,sep } from 'node:path'
import { fileURLToPath,pathToFileURL } from 'node:url'
import { networkInterfaces } from 'node:os'
import { WebSocketServer,WebSocket } from 'ws'
import { PartyRoom } from './room.mjs'
import { readAsset } from './static-assets.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json','.wasm':'application/wasm','.task':'application/octet-stream'}
export function lanAddresses(port){return [...new Set(Object.values(networkInterfaces()).flat().filter(n=>n&&n.family==='IPv4'&&!n.internal&&!n.address.startsWith('169.254.')).map(n=>`http://${n.address}:${port}`))]}
export async function createPartyServer({port=5173,host='0.0.0.0',dev=false}={}){
  const room=new PartyRoom(),clients=new Map(),server=createServer(),wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false})
  let vite=null,tickTimer,heartbeatTimer,boundPort=port,closed=false,sequence=0
  if(dev){const{createServer:createVite}=await import('vite');vite=await createVite({root,appType:'spa',server:{middlewareMode:true,hmr:{server}}})}
  const send=(socket,message)=>{if(socket.readyState===WebSocket.OPEN&&socket.bufferedAmount<256000)socket.send(JSON.stringify(message))}
  const broadcast=message=>{for(const socket of clients.keys())send(socket,message)}
  const reply=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
  server.on('request',async(req,res)=>{
    let pathname
    try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{reply(res,400,{error:'Bad URL'});return}
    if(pathname==='/api/info'){reply(res,200,{title:'콜라텍',players:room.players.size,capacity:32,lan:lanAddresses(boundPort),port:boundPort});return}
    if(pathname==='/api/health'){reply(res,200,{ok:true,players:room.players.size});return}
    if(vite){vite.middlewares(req,res);return}
    if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,{error:'Method not allowed'});return}
    let file=resolve(root,'dist','.'+pathname)
    if(!file.startsWith(resolve(root,'dist')+sep)&&file!==resolve(root,'dist')){reply(res,403,{error:'Forbidden'});return}
    try{
      if((await stat(file).catch(()=>null))?.isDirectory())file=resolve(file,'index.html')
      let asset=await readAsset(file,req.headers['accept-encoding'])
      if(!asset&&!extname(pathname)){file=resolve(root,'dist/index.html');asset=await readAsset(file,req.headers['accept-encoding'])}
      if(!asset){reply(res,404,{error:'파일이 없어요. 먼저 npm run build를 실행해주세요.'});return}
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':file.includes('/assets/')?'public, max-age=31536000, immutable':file.includes('/mediapipe/')?'public, max-age=86400':'no-cache','Vary':'Accept-Encoding',...(asset.encoding?{'Content-Encoding':asset.encoding}:{}),'X-Content-Type-Options':'nosniff'})
      res.end(req.method==='HEAD'?undefined:asset.data)
    }catch{reply(res,500,{error:'Unable to serve application'})}
  })
  server.on('upgrade',(req,socket,head)=>{
    if(req.url?.split('?')[0]!=='/party')return
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return}}catch{socket.destroy();return}}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req))
  })
  wss.on('connection',socket=>{
    let id=null,alive=true,count=0,rateAt=Date.now()
    const joinDeadline=setTimeout(()=>{if(!id)socket.close(1008,'Join first')},10000)
    socket.on('pong',()=>{alive=true})
    socket.on('message',data=>{
      const now=Date.now();if(now-rateAt>=1000){rateAt=now;count=0}if(++count>80){socket.close(1008,'Too many messages');return}
      let message;try{message=JSON.parse(data.toString())}catch{return}
      if(!message||typeof message!=='object')return
      if(message.type==='join'){
        if(id)return
        try{const p=room.join(message.nickname,message.resume);id=p.id;clients.set(socket,id);clearTimeout(joinDeadline);send(socket,{type:'welcome',id,session:p.session,players:room.roster(),time:now});broadcast({type:'joined',player:room.describe(p),time:now})}
        catch(error){send(socket,{type:'error',message:error.message});socket.close(1008,'Join rejected')}
      }else if(id&&message.type==='move')room.input(id,message.dx,message.dz)
      else if(id&&message.type==='action')room.action(id,message.action)
    })
    socket.on('error',()=>{})
    socket.on('close',()=>{clearTimeout(joinDeadline);if(id){room.leave(id);clients.delete(socket);broadcast({type:'left',id,time:Date.now()})}})
    socket.isAlive=()=>alive;socket.markPing=()=>{alive=false}
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);boundPort=server.address().port;resolve()})})
  let previous=performance.now()
  tickTimer=setInterval(()=>{const now=performance.now();room.tick((now-previous)/1000);previous=now;if(clients.size)broadcast({type:'state',players:room.snapshot(),time:Date.now(),seq:sequence++})},50)
  heartbeatTimer=setInterval(()=>{for(const socket of wss.clients){if(!socket.isAlive()){socket.terminate();continue}socket.markPing();socket.ping()}},10000)
  return {server,room,port:boundPort,url:`http://127.0.0.1:${boundPort}`,lan:lanAddresses(boundPort),async close(){if(closed)return;closed=true;clearInterval(tickTimer);clearInterval(heartbeatTimer);for(const socket of wss.clients)socket.terminate();await new Promise(r=>wss.close(r));if(vite)await vite.close();server.closeAllConnections();await new Promise(r=>server.close(r))}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const requestedPort=Number(process.env.PORT||5173)
  try{
    const service=await createPartyServer({port:requestedPort,dev:process.argv.includes('--dev')})
    console.log(`\n  파파괴 · 인터랙션 아카이브\n  이 컴퓨터: ${service.url}\n${service.lan.map(url=>`  같은 네트워크: ${url}`).join('\n')}\n  카메라는 localhost 또는 HTTPS에서 사용할 수 있어요. 상단 메뉴에서 파파괴, Snow, WaterTouch를 전환할 수 있어요.\n`)
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await service.close();process.exit(0)})
  }catch(error){console.error(error.code==='EADDRINUSE'?`포트 ${requestedPort}이 사용 중입니다. PORT=5174 npm start로 다른 포트를 사용할 수 있어요.`:error);process.exit(1)}
}
