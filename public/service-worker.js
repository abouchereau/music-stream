const BASE62_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';


self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  
  if (url.pathname.startsWith('/proxy/stream')) {  
    event.respondWith(handleProtectedAudio(req));
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
    let tmp = newUrl.split('/');
    tmp[tmp.length-1] = plyrTrackInv(tmp[tmp.length-1]);
    newUrl = tmp.join('/');
    
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

