import { setGlobalProxyFromEnv } from 'node:http';
import { execFileSync } from 'node:child_process';

export function windowsProxy(){
 if(process.platform!=='win32')return '';
 try{
  const key='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
  const read=name=>execFileSync('reg.exe',['query',key,'/v',name],{encoding:'utf8',timeout:3000,windowsHide:true,stdio:['ignore','pipe','ignore']});
  if(!/ProxyEnable\s+REG_DWORD\s+0x1\b/i.test(read('ProxyEnable')))return '';
  const server=read('ProxyServer').match(/ProxyServer\s+REG_SZ\s+(.+)/i)?.[1].trim()||'';
  const address=server.includes('=')?(server.split(';').find(v=>v.startsWith('https='))||server.split(';').find(v=>v.startsWith('http=')))?.split('=').slice(1).join('='):server;
  if(!address)return '';
  const url=new URL(address.includes('://')?address:'http://'+address);
  return ['http:','https:'].includes(url.protocol)?url.href:'';
 }catch{return '';}
}

// Respect the user's existing network configuration; never alter the OS proxy.
// Called once before the server begins requests. Loopback stays local.
export function configureNetwork(env=process.env,systemProxy=windowsProxy){
 const proxy=env.https_proxy||env.HTTPS_PROXY||env.http_proxy||env.HTTP_PROXY||systemProxy();
 if(!proxy)return false;
 setGlobalProxyFromEnv({HTTPS_PROXY:proxy,HTTP_PROXY:env.http_proxy||env.HTTP_PROXY||proxy,NO_PROXY:[env.no_proxy||env.NO_PROXY,'localhost','127.0.0.1','::1'].filter(Boolean).join(',')});
 return true;
}
