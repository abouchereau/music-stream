
    let playlistDir = window.location.pathname.slice(1);
    if(playlistDir == "") {
      playlistDir = "%20";
    } 
 
 if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js?v=0.10',{scope: '/'+playlistDir})
        .then(reg => console.log('SW registered', reg))
        .catch(err => console.error('SW reg failed', err));
    }
    const API_URL = "/api"; 
    const PROXY_URL = "/proxy"; 
    const player = new Plyr('#player',{
        controls: ['play', 'progress', 'current-time', 'mute']
    });



    const playlist = document.getElementById('playlist');
    let current = 0;
    let tracks = [];

    const loadTrack = async (index) => {
      const items = playlist.querySelectorAll('li');
      items.forEach(li => li.classList.remove('active'));
      const curLi = Array.from(items).find(li => li.dataset.index==index)
      curLi.classList.add('active');

        const urlAudio = PROXY_URL+"/stream/"+playlistDir+"/"+index;
      player.source = {
        type: 'audio',
        sources: [
          {
            src: urlAudio,
            type: 'audio/mpeg'
          }
        ]
      };
      current = index;
        if (index != 0) {
          player.play()
              .catch(() => {
                  console.warn('Impossible de lire ce morceau :', err);
                  // Empêche la boucle
                  player.stop();
            });
        }
    }






  const loadTrackList = async () => {
    let res = await fetch(API_URL+"/tracks/"+playlistDir, {
              method: 'GET',
              headers: {
              'Content-Type': 'application/json'
              }
          });
          tracks = await res.json();

        tracks.forEach((track, index) => {
          const li = document.createElement('li');
          li.setAttribute("data-index", index);
          li.innerHTML = `
            <div><strong>${track.title}</strong> – ${track.artist || 'Inconnu'}</div>
            <div class="track-meta">${formatDuration(track.duration)}</div>
          `;
          li.addEventListener('click', e => loadTrack(Number(e.currentTarget.dataset.index)));
          playlist.appendChild(li);
        });
        // Charger la première piste
        if (tracks.length > 0) {
          loadTrack(0);
        }
  };

document.addEventListener('DOMContentLoaded', () => {
  loadTrackList();
  document.head.innerHTML += '<link rel="stylesheet" href="api/'+playlistDir+'/style.css" type="text/css"/>';

}, false);

    player.on('ended', () => {    
      const next = (current + 1);        
        if (next > 0 && next < tracks.length) {
          loadTrack(next);
        }
    });

    function formatDuration(sec) {
      if (!sec) return '';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
