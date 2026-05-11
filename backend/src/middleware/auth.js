const jwt = require('jsonwebtoken');

const { sanitizeUser } = require('../lib/utils');
const User = require('../models/User');

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
    const mongoUser = await User.findById(decoded.id);

    if (!mongoUser || mongoUser.isActive === false) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
      });
    }

    req.user = sanitizeUser(mongoUser);
    next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this resource',
    });
  }
};
