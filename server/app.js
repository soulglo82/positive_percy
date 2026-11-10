import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import routes, { setBroadcast } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the HTTP app, WebSocket server and broadcast wiring without starting
// to listen or touching the database, so tests can run it on a random port.
export function createApp() {
  const app = express();
  const server = http.createServer(app);

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

  return { app, server, wss, broadcast };
}
