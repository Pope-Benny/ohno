import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import api from './api.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'ohno' }));
app.use('/api', api);

function findClientDist() {
  const candidates = [
    process.env.CLIENT_DIST,
    path.resolve(process.cwd(), 'client', 'dist'),
    path.resolve(process.cwd(), '..', 'client', 'dist'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
}

const dist = findClientDist();
if (dist) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  app.get('/', (req, res) =>
    res.status(200).json({ app: 'ohno', note: 'client build not found' })
  );
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`ohno (大野) listening on :${PORT}${dist ? ` · serving ${dist}` : ' · no client build'}`);
});
