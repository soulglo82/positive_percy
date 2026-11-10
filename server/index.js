import { getJwtSecret } from './routes.js';
import { initDb } from './db.js';
import { createApp } from './app.js';

// Refuse to start without a proper signing secret. No fallback, in any mode.
try {
  getJwtSecret();
} catch (err) {
  console.error(`Startup refused: ${err.message}`);
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const { server } = createApp();

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
