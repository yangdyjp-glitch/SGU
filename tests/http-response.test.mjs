import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { gunzipSync } from 'node:zlib';
import { sendContent, sendJson } from '../lib/http-response.mjs';

test('large responses compress losslessly, respect encoding opt-outs and keep private data uncached',async()=>{
 const value={text:'学历资格与项目规则。'.repeat(20000)},source='const name="资料维护";\n'.repeat(100);
 const server=http.createServer((req,res)=>req.url==='/app.js'
  ?sendContent(req,res,200,source,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'},{etag:true})
  :sendJson(req,res,200,value));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const get=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:server.address().port,path,headers,method},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
  });req.on('error',reject);req.end();
 });
 try{
  const zipped=await get('/api/bootstrap',{'Accept-Encoding':'br, gzip'});
  assert.equal(zipped.headers['content-encoding'],'gzip');assert.deepEqual(JSON.parse(gunzipSync(zipped.body)),value);
  assert.ok(zipped.body.length<Buffer.byteLength(JSON.stringify(value))/10);
  assert.equal(zipped.headers['cache-control'],'no-store');assert.equal(zipped.headers.etag,undefined);
  assert.equal(Number(zipped.headers['content-length']),zipped.body.length);assert.equal(zipped.headers.vary,'Accept-Encoding');
  for(const encoding of ['identity','gzip;q=0, *;q=1','br']){
   const plain=await get('/api/bootstrap',{'Accept-Encoding':encoding});
   assert.equal(plain.headers['content-encoding'],undefined);assert.deepEqual(JSON.parse(plain.body),value);
  }
  const asset=await get('/app.js',{'Accept-Encoding':'gzip'});
  assert.equal(gunzipSync(asset.body).toString(),source);
  const cached=await get('/app.js',{'If-None-Match':asset.headers.etag,'Accept-Encoding':'gzip'});
  assert.equal(cached.status,304);assert.equal(cached.body.length,0);
  const head=await get('/app.js',{'Accept-Encoding':'gzip'},'HEAD');
  assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(head.headers['content-length'],asset.headers['content-length']);
 }finally{server.close();await once(server,'close');}
});
