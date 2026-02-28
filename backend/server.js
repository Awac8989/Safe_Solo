require('dotenv').config();
const http = require('http');

const { app } = require('./src/app');
const { initDatabase } = require('./src/config/sqlite');
const { initializeSocket } = require('./src/sockets/socketServer');
const { startDeadManWorker } = require('./src/workers/deadmanWorker');

const port = process.env.PORT || 4000;

async function bootstrap() {
  initDatabase();

  const server = http.createServer(app);
  const io = initializeSocket(server);
  startDeadManWorker(io);

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`SafeSolo backend running at http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Backend bootstrap failed:', error);
  process.exit(1);
});