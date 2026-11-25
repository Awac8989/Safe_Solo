require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const { initializeSocket } = require('./src/sockets/socketServer');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const database = require('./src/config/database');
const { startDuressWorkers } = require('./src/workers/duressWorker');
const { startDeadManWorker } = require('./src/workers/deadmanWorker');
const { startDispatchWorker } = require('./src/workers/dispatchWorker');
const { startCertificationWatchdog } = require('./src/workers/certificationWatchdog');
const { apiRouter } = require('./src/routes');
const apiKeyAuth = require('./src/middleware/apiKeyAuth');

const emergencyRoutes = require('./src/routes/emergencyRoutes');
const adminPortalRoutes = require('./src/routes/adminPortalRoutes');

const app = express();
const server = createServer(app);
const io = initializeSocket(server);
const port = process.env.PORT || 4000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 5000,
  skip: (req) =>
    req.path.startsWith('/api/watch') ||
    req.path.startsWith('/watch') ||
    req.path.startsWith('/api/admin') ||
    req.path.includes('/health'),
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-user-id']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'SafeSolo Backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'SafeSolo API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiKeyAuth);
app.use('/api/v1', apiKeyAuth);

// Unified API router: includes all domain routes (/auth, /medical, /moments, /watch, /safetags, etc.)
app.use('/api', apiRouter);
app.use('/api/v1', apiRouter);

// Backward-compatible singular alias & Web Admin TOC routes (avoid duplicate router mounts)
app.use('/api/emergency', emergencyRoutes);
app.use('/api/admin', adminPortalRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await database.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await database.$disconnect();
  process.exit(0);
});

server.listen(port, '0.0.0.0', async () => {
  try {
    await database.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  try {
    startDeadManWorker(io);
  } catch (e) {
    console.warn('DeadMan worker init warning:', e.message);
  }

  try {
    startDuressWorkers();
  } catch (e) {
    console.warn('Duress worker init warning:', e.message);
  }

  try {
    startDispatchWorker(io);
  } catch (e) {
    console.warn('Dispatch worker init warning:', e.message);
  }

  try {
    const telegramBotService = require('./src/services/telegramBotService');
    telegramBotService.startPolling();
  } catch (e) {
    console.warn('Telegram bot init warning:', e.message);
  }

  try {
    startCertificationWatchdog();
  } catch (e) {
    console.warn('Certification watchdog init warning:', e.message);
  }

  console.log(`SafeSolo Backend running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
