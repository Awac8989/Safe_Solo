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
const emergencyRoutes = require('./src/routes/emergencyRoutes');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const medicalRoutes = require('./src/routes/medicalRoutes');
const guardianRoutes = require('./src/routes/guardianRoutes');
const locationRoutes = require('./src/routes/locationRoutes');
const radarRoutes = require('./src/routes/radarRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const feedRoutes = require('./src/routes/feedRoutes');
const communityRoutes = require('./src/routes/communityRoutes');
const kycRoutes = require('./src/routes/kycRoutes');

const app = express();
const server = createServer(app);
const io = initializeSocket(server);
const port = process.env.PORT || 4000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SafeSolo Backend is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
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

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
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

// Start server
server.listen(port, async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  // Start duress monitoring workers after socket is ready
  startDuressWorkers();

  console.log(`🚀 SafeSolo Backend running at http://localhost:${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;