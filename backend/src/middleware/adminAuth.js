const jwt = require('jsonwebtoken');
const SystemLog = require('../models/SystemLog');

const JWT_SECRET = process.env.JWT_SECRET || 'safesolo-dev-secret';
const VALID_ROLES = new Set(['superadmin', 'dispatcher', 'moderator']);

/**
 * Xác thực JWT phiên trực Trung tâm Điều phối TOC (Web Admin).
 * Chặn tuyệt đối request không có token, token giả, hết hạn hoặc token user thường.
 */
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : null;
  const token = bearerToken || queryToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'ADMIN_AUTH_REQUIRED',
      error: 'Phiên trực TOC chưa xác thực (Thiếu JWT Admin Token). Vui lòng đăng nhập lại.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.tokenType !== 'admin_toc' || !VALID_ROLES.has(decoded.role)) {
      return res.status(401).json({
        success: false,
        code: 'ADMIN_TOKEN_INVALID_SCOPE',
        error: 'Token không có thẩm quyền truy cập Cổng Chỉ Huy TOC.',
      });
    }

    req.adminUser = {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      roleTitle: decoded.roleTitle,
      badgeNumber: decoded.badgeNumber,
      shiftStartTime: decoded.shiftStartTime,
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: 'ADMIN_TOKEN_EXPIRED',
      error: 'Phiên trực TOC đã hết hạn hoặc chữ ký token không hợp lệ.',
    });
  }
}

/**
 * Kiểm tra phân quyền RBAC thực tế ở Backend cho từng nhóm chức năng TOC.
 */
function requireAdminRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({
        success: false,
        code: 'ADMIN_AUTH_REQUIRED',
        error: 'Chưa xác thực nhân sự TOC.',
      });
    }

    if (!allowedRoles.includes(req.adminUser.role)) {
      try {
        await SystemLog.create({
          actionType: 'ADMIN_RBAC_DENIED',
          metadata: {
            actorId: req.adminUser.id,
            actorEmail: req.adminUser.email,
            actorRole: req.adminUser.role,
            requiredRoles: allowedRoles,
            method: req.method,
            path: req.originalUrl,
            ip: req.ip,
          },
        });
      } catch (_) {}

      return res.status(403).json({
        success: false,
        code: 'RBAC_FORBIDDEN',
        error: `Phân quyền RBAC từ chối: Vai trò [${req.adminUser.role}] không được phép gọi ${req.method} ${req.originalUrl}. Yêu cầu: [${allowedRoles.join(', ')}].`,
        requiredRoles: allowedRoles,
        actualRole: req.adminUser.role,
      });
    }

    return next();
  };
}

module.exports = {
  requireAdminAuth,
  requireAdminRole,
  JWT_SECRET,
};
