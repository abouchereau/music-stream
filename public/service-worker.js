self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
    console.log("URL",url.pathname);
  if (url.pathname.startsWith('/stream')) {
    event.respondWith(handleProtectedAudio(req));
  }
});


async function handleProtectedAudio(originalRequest) {
    console.log("handleProtectedAudio", originalRequest );
  try {
    let url = new URL(originalRequest.url);
    console.log("handleProtectedAudio", url);
    const API_URL = "https://node-player.lasaugrenue.fr"; 
    const tokenResp = await fetch(API_URL+"/token");
    console.log("tokenStr",tokenStr);
    const tokenStr = await tokenResp.text();
    console.log("tokenStr",tokenStr);
    url = url.replace("/stream/", "/stream/"+tokenStr+"/");
    console.log("new URL",url);
    const headers = {};
    if (originalRequest.headers.has('range')) {
      headers['range'] = originalRequest.headers.get('range');
    }
    if (originalRequest.headers.has('accept')) {
      headers['accept'] = originalRequest.headers.get('accept');
    }
    const resp = await fetch(url, {
      method: 'GET',
      headers,
    });
    return resp;
  } catch (err) {
    return new Response('Service worker error', { status: 500 });
  }
}