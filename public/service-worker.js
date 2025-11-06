const BASE62_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CACHE_NAME = 'forbidden-zone';
let cache = null;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', async event => {
  event.waitUntil(async ()=>{
    self.clients.claim();
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));    
    cache = await caches.open(CACHE_NAME);
  })
});

self.addEventListener('fetch',async event => {
  console.log(event);
  const req = event.request;
  const url = new URL(req.url);
  
  if (url.pathname.startsWith('/proxy/stream')) {  
    event.respondWith(handleProtectedAudio(req));
  }

  if (url.pathname.startsWith('/test')) {  
    console.log("REFERRER", event.request.referrer);
    await fetch("/test",{ method: 'GET'});
    
    event.respondWith(new Response('Hello from SW', {
        status: 200,
        statusText: 'ok',
        headers: { 'Content-Type': 'text/plain' }
      }));
  }
});


async function handleProtectedAudio(originalRequest) {
  try {

    const headers = {};
    if (originalRequest.headers.has('range')) {
      headers['range'] = originalRequest.headers.get('range');
    }
    if (originalRequest.headers.has('accept')) {
      headers['accept'] = originalRequest.headers.get('accept');
    }    
    if (originalRequest.headers.has('authorization')) {
      headers['authorization'] = originalRequest.headers.get('authorization');
    }

    let url = new URL(originalRequest.url);
    const API_URL = "/api"; 
    const tokenResp = await fetch(API_URL+"/token",{ method: 'GET'});
    const tokenStr = await tokenResp.text();
    let newUrl = url.href.replace("/stream/", "/stream/"+tokenStr+"/").replace("/proxy/", "/api/");
 //   let tmp = newUrl.split('/');
//    let str = tmp[tmp.length-1];
 /*   await cache.get(, response);
    const match = await cache.match("ids");
    let blockedIds = [];
    if (match) {
      blockedIds = match.json();
      if(blockedIds.includes(str)) {
      return new Response('Not found', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'text/plain' }
      })
    }
    blockedIds.push(str);
    
    await cache.put("ids",JSON.stringify(blockedIds));
*/
  //  tmp[tmp.length-1] = plyrTrackInv(str);
//    newUrl = tmp.join('/');
    
    const backendResp = await fetch(newUrl, { headers });

   return new Response(backendResp.body, {
      status: backendResp.status,
      statusText: backendResp.statusText,
      headers: backendResp.headers
    });

  } catch (err) {
    return new Response('Service worker error', { status: 500 });
  }
}


function fromBase62(str) {
  const base = BASE62_ALPHABET.length;
  let num = 0;

  for (let i = 0; i < str.length; i++) {
    const value = BASE62_ALPHABET.indexOf(str[i]);
    if (value === -1) throw new Error(`Caractère invalide : ${str[i]}`);
    num = num * base + value;
  }

  return num;
}

function plyrTrackInv(str) {
  const decoded = fromBase62(str);
  const decodedStr = ('000000000000'+decoded).slice(-12);
  return Number(decodedStr.substr(5,2));
}

