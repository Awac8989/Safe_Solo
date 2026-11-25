const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const { JWT_SECRET } = require('../middleware/adminAuth');

function hashScrypt(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function verifyScrypt(password, salt, expectedHex) {
  const actualBuf = Buffer.from(hashScrypt(password, salt), 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

// Danh sách nhân sự ca trực TOC (Mật khẩu lưu dạng scrypt salt+hash trong bộ nhớ / biến môi trường)
const TOC_STAFF_REGISTRY = [
  {
    id: 'admin_01',
    name: 'Đoàn Minh Quân (Chỉ Huy Trưởng)',
    email: 'admin@safesolo.vn',
    role: 'superadmin',
    roleTitle: 'Tổng Chỉ Huy Hệ Thống (Super Admin)',
    badgeNumber: 'TOC-ADMIN-01',
    salt: crypto.randomBytes(16).toString('hex'),
    passPlainInit: process.env.TOC_SUPERADMIN_PASSWORD || 'admin123',
  },
  {
    id: 'dispatch_02',
    name: 'Nguyễn Văn Hùng (Trưởng Ca 115)',
    email: 'dispatch@safesolo.vn',
    role: 'dispatcher',
    roleTitle: 'Trưởng Ca Điều Phối 115 / SOS',
    badgeNumber: 'DISPATCH-115-09',
    salt: crypto.randomBytes(16).toString('hex'),
    passPlainInit: process.env.TOC_DISPATCHER_PASSWORD || 'dispatch123',
  },
  {
    id: 'mod_03',
    name: 'Lê Thị Mai (Chuyên Viên Pháp Lý & KYC)',
    email: 'moderator@safesolo.vn',
    role: 'moderator',
    roleTitle: 'Kiểm Duyệt Viên KYC & Pháp Lý',
    badgeNumber: 'MOD-KYC-22',
    salt: crypto.randomBytes(16).toString('hex'),
    passPlainInit: process.env.TOC_MODERATOR_PASSWORD || 'mod123',
  },
].map((staff) => {
  const passwordHash = hashScrypt(staff.passPlainInit, staff.salt);
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    roleTitle: staff.roleTitle,
    badgeNumber: staff.badgeNumber,
    salt: staff.salt,
    passwordHash,
  };
});

function buildAdminPayload(staff, shiftStartTime) {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    roleTitle: staff.roleTitle,
    badgeNumber: staff.badgeNumber,
    shiftStartTime:
      shiftStartTime ||
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

async function recordAdminAuthAudit(actionType, metadata) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    await SystemLog.create({ actionType, metadata });
  } catch (_) {}
}

/**
 * POST /api/admin/auth/login
 * Xác thực tài khoản TOC và cấp JWT token có chữ ký & role thực tế.
 */
async function loginAdmin(req, res) {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');

  if (!cleanEmail || !rawPassword) {
    return res.status(400).json({
      success: false,
      error: 'Vui lòng nhập đầy đủ Email ca trực và Mật khẩu.',
    });
  }

  let matchedUser = null;
  const registryStaff = TOC_STAFF_REGISTRY.find((s) => s.email === cleanEmail);
  if (registryStaff && verifyScrypt(rawPassword, registryStaff.salt, registryStaff.passwordHash)) {
    matchedUser = buildAdminPayload(registryStaff);
  } else if (!registryStaff && mongoose.connection.readyState === 1) {
    // Cho phép tài khoản User có role === 'admin' trong MongoDB đăng nhập khi đúng mật khẩu bcrypt
    const dbAdmin = await User.findOne({ email: cleanEmail, role: 'admin', isActive: { $ne: false } }).lean();
    if (dbAdmin && dbAdmin.passwordHash && bcrypt.compareSync(rawPassword, dbAdmin.passwordHash)) {
      matchedUser = buildAdminPayload({
        id: String(dbAdmin._id),
        name: dbAdmin.fullName || dbAdmin.email,
        email: dbAdmin.email,
        role: 'superadmin',
        roleTitle: 'Quản Trị Viên Hệ Thống (MongoDB)',
        badgeNumber: `TOC-${String(dbAdmin._id).slice(-4).toUpperCase()}`,
      });
    }
  }

  if (!matchedUser) {
    await recordAdminAuthAudit('ADMIN_TOC_LOGIN_FAILED', {
      email: cleanEmail,
      ip: req.ip,
      reason: 'INVALID_CREDENTIALS',
    });
    return res.status(401).json({
      success: false,
      error: 'Email hoặc mật khẩu ca trực không chính xác!',
    });
  }

  const token = jwt.sign(
    {
      ...matchedUser,
      tokenType: 'admin_toc',
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  await recordAdminAuthAudit('ADMIN_TOC_LOGIN_SUCCESS', {
    actorId: matchedUser.id,
    email: matchedUser.email,
    role: matchedUser.role,
    badgeNumber: matchedUser.badgeNumber,
    ip: req.ip,
  });

  return res.json({
    success: true,
    data: {
      token,
      expiresInSeconds: 12 * 3600,
      user: matchedUser,
    },
  });
}

/**
 * GET /api/admin/auth/me
 * Xác thực phiên JWT đang giữ và trả về danh tính + role thật được Backend bảo chứng.
 */
function getAdminMe(req, res) {
  return res.json({
    success: true,
    data: {
      user: req.adminUser,
    },
  });
}

module.exports = {
  loginAdmin,
  getAdminMe,
};
