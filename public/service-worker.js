self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  console.log("SW FETCH")
  const req = event.request;
  const url = new URL(req.url);
    console.log("URL",url.pathname);
  if (url.pathname.startsWith('/music/stream')) {
    event.respondWith(handleProtectedAudio(req));
  }
});


async function handleProtectedAudio(originalRequest) {
    console.log("handleProtectedAudio", originalRequest );
  try {

    const headers = {};

    console.log(originalRequest.headers);
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
    console.log("handleProtectedAudio", url);
    const API_URL = "/api"; 
    const tokenResp = await fetch(API_URL+"/token",{
      method: 'GET'    
    });
    console.log("tokenResp",tokenResp);
    const tokenStr = await tokenResp.text();
    console.log("tokenStr",tokenStr);
    let newUrl = url.href.replace("/stream/", "/stream/"+tokenStr+"/");
    console.log("new URL",newUrl);
    
    const resp = await fetch(newUrl, {
      method: 'GET',
      headers
    });
    return resp;
  } catch (err) {
    return new Response('Service worker error', { status: 500 });
  }
}
