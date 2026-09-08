const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL;
let redisClient = null;
let warnedOnce = false;

if (redisUrl) {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 2) {
        if (!warnedOnce) {
          warnedOnce = true;
          // eslint-disable-next-line no-console
          console.log('[SafeSolo] Redis connection unavailable. Background queue disabled.');
        }
        return null;
      }
      return 1000;
    },
  });

  redisClient.on('error', (error) => {
    if (!warnedOnce) {
      warnedOnce = true;
      // eslint-disable-next-line no-console
      console.log('[SafeSolo] Redis error (optional):', error.message);
    }
  });
}

module.exports = redisClient;

