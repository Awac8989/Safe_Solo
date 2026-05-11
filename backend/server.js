require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { initializeSocket } = require('./src/sockets/socketServer');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const prisma = require('./src/config/database');
const { startDuressWorkers } = require('./src/workers/duressWorker');
const { startDeadManWorker } = require('./src/workers/deadmanWorker');
const { apiRouter } = require('./src/routes');

const emergencyRoutes = require('./src/routes/emergencyRoutes');
const authRoutes = require('./src/routes/authRoutes');
const medicalRoutes = require('./src/routes/medicalRoutes');
const guardianRoutes = require('./src/routes/guardianRoutes');
const locationRoutes = require('./src/routes/locationRoutes');
const radarRoutes = require('./src/routes/radarRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const feedRoutes = require('./src/routes/feedRoutes');
const communityRoutes = require('./src/routes/communityRoutes');
const kycRoutes = require('./src/routes/kycRoutes');
const adminPortalRoutes = require('./src/routes/adminPortalRoutes');

const app = express();
const server = createServer(app);
const io = initializeSocket(server);
const port = process.env.PORT || 4000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
});

app.use(cors());
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

// Unified API router: includes Flutter legacy endpoints such as /api/users/register.
app.use('/api', apiRouter);

// Keep direct mounts for existing clients using these exact paths.
app.use('/api/auth', authRoutes);
app.use('/api/medical', medicalRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/radar', radarRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/admin', adminPortalRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

server.listen(port, async () => {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  startDeadManWorker(io);
  try {
    startDuressWorkers();
  } catch (error) {
    console.error('Duress workers disabled:', error.message);
  }

  console.log(`SafeSolo Backend running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
