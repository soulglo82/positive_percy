import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import routes, { setBroadcast, verifyToken } from './routes.js';
import pool from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the HTTP app, WebSocket server and broadcast wiring without starting
// to listen or touching the database, so tests can run it on a random port.
export function createApp() {
  const app = express();
  const server = http.createServer(app);

  // Railway's edge is the one proxy hop in front and appends the real client
  // IP to X-Forwarded-For. Trusting exactly one hop keys limits on that entry,
  // so a client-supplied X-Forwarded-For value cannot pick its own key. This
  // relies on the app being reachable only through Railway's edge.
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
        // Not meaningful in report-only mode and makes browsers log a warning.
        upgradeInsecureRequests: null,
      },
    },
  }));

  // The family code is the only credential, so guessing it must be slow.
  const limit = (windowMinutes, max) => rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // IPv6 clients are limited per /64, so rotating addresses does not help.
    keyGenerator: (req) => ipKeyGenerator(req.ip, 64),
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  });
  app.post('/api/family/join', limit(15, 10));
  app.post('/api/family/create', limit(60, 10));
  app.post('/api/upload', limit(15, 60));

  // Uploads are capped at 2MB of image, which is about 2.7MB as base64.
  app.use(express.json({ limit: '3mb' }));

  // Healthcheck for Railway: answers only once startup (schema and
  // migrations) has finished and the database responds. No auth, no limit.
  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  // API routes
  app.use(routes);

  // Malformed or oversized JSON gets a plain JSON error, not Express's HTML
  // page echoing the parser message.
  app.use('/api', (err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    return next(err);
  });

  // Serve the built React frontend
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // WebSocket server (ENH-007)
  // Join messages are tiny; refuse anything big before parsing it.
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  const JOIN_TIMEOUT_MS = 10000;
  const familyClients = new Map(); // familyCode -> Set<ws>

  wss.on('connection', (ws) => {
    let familyCode = null;
    let expiryTimer = null;
    // A socket that never joins with a valid token is closed.
    const joinTimer = setTimeout(() => { if (!familyCode) ws.close(4401, 'Authentication required'); }, JOIN_TIMEOUT_MS);

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw);
        // The room comes from the verified token only. A client-supplied
        // family_code is ignored, and a join without a valid token is dropped.
        if (msg.type === 'join') {
          const auth = verifyToken(msg.token);
          if (!auth) {
            ws.close(4401, 'Authentication required');
            return;
          }
          const verified = auth.familyCode;
          // Verify that this family is still present before joining its room.
          // Tokens stay cryptographically valid after a family is removed.
          try {
            const { rowCount } = await pool.query(
              'SELECT 1 FROM families WHERE family_code = $1', [verified]
            );
            if (rowCount === 0) {
              ws.close(4401, 'Family no longer available');
              return;
            }
          } catch {
            ws.close(1011, 'Could not verify session');
            return;
          }
          if (ws.readyState !== 1) return;
          clearTimeout(joinTimer);
          // Leave the room when the token expires; the client reconnects with a fresh one.
          clearTimeout(expiryTimer);
          if (auth.expiresAt) {
            const ms = Math.max(0, auth.expiresAt - Date.now());
            expiryTimer = setTimeout(() => ws.close(4401, 'Session expired'), Math.min(ms, 2 ** 31 - 1));
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
      clearTimeout(joinTimer);
      clearTimeout(expiryTimer);
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
