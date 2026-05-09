const jwt = require('jsonwebtoken');

const { readState } = require('../data/store');
const { sanitizeUser } = require('../lib/utils');

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this resource',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'safesolo-dev-secret');
    const state = readState();
    const user = state.users.find((item) => item.id === decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
      });
    }

    req.user = sanitizeUser(user);
    next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this resource',
    });
  }
};
