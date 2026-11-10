import { initDb } from './db.js';
import { createApp } from './app.js';

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
