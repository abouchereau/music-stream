self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', async event => {
  event.waitUntil(self.clients.claim())
});

self.addEventListener('fetch',async event => {
  const req = event.request;
  const url = new URL(req.url);
  const client = event.clientId ? await self.clients.get(event.clientId) : null;
/*
  if (!client) {
    return new Response('Forbidden', {status: 403, headers: {'Cache-Control': 'no-store'}});
  }
*/
  const referrer = event.request.referrer || client.url || '';
  console.log("REFERRER", referrer);
  if (!referrer.startsWith('https://player.lasaugrenue.fr')) {
    
    console.log("FORBIDDEN", referrer);
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
    let newUrl = url.href.replace("/stream/", "/stream/"+tokenStr+"/").replace("/proxy/","/api/");
    

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
