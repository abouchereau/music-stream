self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', async event => {
  event.waitUntil(async ()=>{
    self.clients.claim();
  })
});

self.addEventListener('fetch',async event => {
  const req = event.request;
  const url = new URL(req.url);
  const client = event.clientId ? await self.clients.get(event.clientId) : null;

  if (!client) {
    return new Response('Forbidden', {status: 403, headers: {'Cache-Control': 'no-store'}});
  }

  const referrer = event.request.referrer || client.url || '';
  if (!referrer.startsWith('https://player.lasaugrenue.fr')) {
    return new Response('Forbidden', {status: 403, headers: {'Cache-Control': 'no-store'}});
  }
  
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
    let newUrl = url.href.replace("/stream/", "/stream/"+tokenStr+"/");
    
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

