const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisClient.on('error', (error) => {
  // eslint-disable-next-line no-console
  console.error('Redis connection error:', error.message);
});

module.exports = redisClient;
