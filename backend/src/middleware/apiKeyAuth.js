const crypto = require('crypto');

// Simulated valid API keys in production this would be in DB or ENV
const VALID_API_KEYS = new Set([
  process.env.PUBLIC_API_KEY || 'default-public-api-key-123',
  'android-app-key-abc',
  'ios-app-key-xyz'
]);

const requireApiKey = (req, res, next) => {
  // Allow Webhooks without API Key but rely on other mechanisms (e.g. Telegram hash verification)
  if (req.path.includes('/webhook')) {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API Key is missing. Access denied.'
    });
  }

  if (!VALID_API_KEYS.has(apiKey)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API Key.'
    });
  }

  next();
};

module.exports = requireApiKey;
