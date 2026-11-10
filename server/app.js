import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes, { setBroadcast, familyCodeFromToken } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the HTTP app, WebSocket server and broadcast wiring without starting
// to listen or touching the database, so tests can run it on a random port.
export function createApp() {
  const app = express();
  const server = http.createServer(app);

  // Railway sits one proxy hop in front. Without this every visitor shares
  // the proxy's IP and one person's rate limit would block everybody.
  app.set('trust proxy', 1);

  // Security headers. The content policy is report-only until the app has
  // been checked in a browser with it enforced; the other headers apply now.
  app.use(helmet({
    contentSecurityPolicy: {
      reportOnly: true,
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
  }));

  // The family code is the only credential, so guessing it must be slow.
  const limit = (windowMinutes, max) => rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  });
  app.post('/api/family/join', limit(15, 10));
  app.post('/api/family/create', limit(60, 10));
  app.post('/api/upload', limit(15, 60));

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
        // The room comes from the verified token only. A client-supplied
        // family_code is ignored, and a join without a valid token is dropped.
        if (msg.type === 'join') {
          const verified = familyCodeFromToken(msg.token);
          if (!verified) {
            ws.close(4401, 'Authentication required');
            return;
          }
          if (familyCode && familyCode !== verified && familyClients.has(familyCode)) {
            familyClients.get(familyCode).delete(ws);
          }
          familyCode = verified;
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
