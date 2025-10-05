import http from 'http';
import express from "express";
import fs from "fs";
import path from "path";
import * as mm from 'music-metadata';
import cors from "cors";
import { fileURLToPath } from 'url';

// Recréation de __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
const PORT = 3616;
const TOKEN_EXPIRATION = 500;//ms
let ROOT_DIR = "/home/kim/data/abouchereau/files/SecureMusicPlayer";
const app = express();
const corsOptions = {
  origin: ["https://player.lasaugrenue.fr","http://localhost:8123", "https://www.lasaugrenue.fr"],
  credentials: true, 
  optionsSuccessStatus: 200,
  exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length'],
  allowedHeaders: ['Range', 'Content-Type', 'Authorization'], 
  methods: ['GET', 'OPTIONS'] 
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());


let tracks = [];
let tokens = [];
if (!fs.existsSync(ROOT_DIR)) {
  ROOT_DIR = path.join(__dirname, '/../playlists');//en dev
}


app.get('/api/token', (req, res) => {
  deleteExpiredTokens();
  const token = generateRandomString();
  const expiration = Date.now()+TOKEN_EXPIRATION;
  tokens.push({token, expiration});
  res.send(token);
});


app.get('/api/stream/:token/:playlist/:index', (req, res) => {
  const tokenStr = req.params.token;
  if (!tokenStr) {
      return res.status(400).send('Bad request');
  }
  const token = tokens.find(t => t.token == tokenStr);
  if (!token) {
    return res.status(400).send('Bad request');
  }

  if(token['expiration'] < Date.now()) {
    return res.status(400).send('Bad request');
  }
  delete tokens[tokenStr];

  const index = req.params.index;
  const playlist = req.params.playlist;

  const track = tracks[index];

  const filePath = ROOT_DIR+(playlist.trim()!=""?"/"+playlist:"")+"/"+track['file'];
  
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).send('File not found');

  const stat = fs.statSync(filePath);
  const total = stat.size;
  // Support des requêtes Range (permet le seek)
  const range = req.headers.range;

  res.set({
  'Access-Control-Allow-Origin': 'https://player.lasaugrenue.fr',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, Content-Length'
});
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
    if (start >= total || end >= total) {
      res.status(416).set('Content-Range', `bytes */${total}`).end();
      return;
    }
    const chunkSize = (end - start) + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline; filename="'+token+'"',
      'Cache-Control': 'no-store'
    });
    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
    stream.on('error', err => {
      console.error(err);
      res.end();
    });
  } else {
    // Envoi complet
    res.writeHead(200, {
      'Content-Length': total,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline; filename="'+token+'"',
      'Cache-Control': 'no-store'
    });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', err => {
      console.error(err);
      res.end();
    });
  }
});

app.get('/api/tracks/:playlistDir', async (req, res) => {
  try {

    const MUSIC_DIR = ROOT_DIR+"/"+req.params.playlistDir.trim();
    if (!fs.existsSync(MUSIC_DIR)) {
      res.json([]);
      return;
    }

    console.log(MUSIC_DIR);

    const files = fs.readdirSync(MUSIC_DIR).filter(f => f.endsWith('.mp3'));

    tracks = await Promise.all(files.map(async (file) => {
      const filePath = path.join(MUSIC_DIR, file);

      try {
        const metadata = await mm.parseFile(filePath);
        return {
          file,
          title: metadata.common.title || path.basename(file, '.mp3'),
          artist: metadata.common.artist || 'Inconnu',
          album: metadata.common.album || '',
          duration: metadata.format.duration ? Math.round(metadata.format.duration) : null,
        };
      } catch (err) {
        console.error(`Erreur lecture tags: ${file}`, err.message);
        return {
          file,
          title: path.basename(file, '.mp3'),
          artist: 'Inconnu',
          album: '',
          duration: null,
        };
      }
    }));
    const retJson = JSON.parse(JSON.stringify(tracks));
    res.json(retJson.map(a=>{delete a.file;return a;}));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Impossible de lire les fichiers audio' });
  }
});

http.createServer({}, app).listen(PORT, function(){
    console.log("Express server listening on port " + PORT);
});

const generateRandomString = (length = 10) => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
};

const deleteExpiredTokens = () => {
  const now = Date.now();
  tokens = tokens.filter(t => t.expiration > now);
};