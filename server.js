// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// SECRET: à stocker de façon sécurisée (env var)
const SECRET = process.env.STREAM_SECRET || 'change_this_secret';

// Mapping id -> fichier réel (remplace par DB dans la vraie vie)
const FILE_MAP = {
  '123': path.join(__dirname, 'assets', 'song1.mp3'),
  '456': path.join(__dirname, 'assets', 'song2.mp3'),
};

// Durée de validité du token (en secondes)
const TOKEN_TTL = 60 * 5; // 5 minutes

function signToken(id, expiresAt) {
  const payload = `${id}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [id, expiresAtStr, sig] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (Number.isNaN(expiresAt)) return false;
    if (Date.now() > expiresAt) return false;
    const expected = crypto.createHmac('sha256', SECRET).update(`${id}:${expiresAt}`).digest('hex');
    // timing-safe compare
    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))) return false;
    return { valid: true, id };
  } catch (e) {
    return false;
  }
}

// Endpoint pour récupérer un token (authentifier avant en prod!)
app.get('/token', (req, res) => {
  const id = req.query.id;
  if (!id || !FILE_MAP[id]) return res.status(404).json({ error: 'Unknown id' });

  // Ici tu devrais vérifier que l'utilisateur a le droit de lire ce fichier (auth)
  const expiresAt = Date.now() + TOKEN_TTL * 1000;
  const token = signToken(id, expiresAt);
  res.json({ token, expiresAt });
});

// Endpoint de streaming sécurisé
app.get('/stream', (req, res) => {
  const token = req.query.token;
  const idQuery = req.query.id;
  if (!token) return res.status(400).send('Missing token');

  const v = verifyToken(token);
  if (!v || !v.valid) return res.status(403).send('Invalid or expired token');

  const id = v.id;
  // Optionnel : vérifier que idQuery correspond à id (ou utiliser id uniquement)
  if (idQuery && idQuery !== id) return res.status(400).send('Bad id');

  const filePath = FILE_MAP[id];
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).send('File not found');

  const stat = fs.statSync(filePath);
  const total = stat.size;

  // Support des requêtes Range (permet le seek)
  const range = req.headers.range;
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
      // inline -> navigateur peut lire directement
      'Content-Disposition': 'inline; filename="audio.mp3"',
      // Désactiver cache côté navigateur si nécessaire
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
      'Content-Disposition': 'inline; filename="audio.mp3"',
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

app.listen(PORT, () => {
  console.log(`Secure audio server listening on http://localhost:${PORT}`);
});