import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { initDb } from './db.js';
import routes, { setBroadcast } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// API routes
app.use(routes);

// Serve the built React frontend
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// WebSocket server (ENH-007)
const wss = new WebSocketServer({ server, path: '/ws' });
const familyClients = new Map(); // familyCode -> Set<ws>

wss.on('connection', (ws) => {
  let familyCode = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'join' && msg.family_code) {
        familyCode = msg.family_code;
        if (!familyClients.has(familyCode)) {
          familyClients.set(familyCode, new Set());
        }
        familyClients.get(familyCode).add(ws);
      }
    } catch {}
  });

  ws.on('close', () => {
    if (familyCode && familyClients.has(familyCode)) {
      familyClients.get(familyCode).delete(ws);
      if (familyClients.get(familyCode).size === 0) {
        familyClients.delete(familyCode);
      }
    }
  });
});

function broadcast(familyCode, event) {
  const clients = familyClients.get(familyCode);
  if (!clients) return;
  const data = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(data);
    }
  }
}

// Share broadcast function with routes
setBroadcast(broadcast);

// Initialize DB and start server
initDb()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
