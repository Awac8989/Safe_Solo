const fs = require('fs');
const path = require('path');

const admin = require('firebase-admin');

const GuardianRelationship = require('../models/GuardianRelationship');
const User = require('../models/User');
const { sanitizeUser } = require('../lib/utils');

let initialized = false;

function parseServiceAccountJson() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  if (rawJson.trim()) {
    return JSON.parse(rawJson);
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '';
  if (serviceAccountPath.trim()) {
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);
    if (fs.existsSync(absolutePath)) {
      return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    }
  }

  return null;
}

function isConfigured() {
  try {
    return Boolean(parseServiceAccountJson());
  } catch (_error) {
    return false;
  }
}

function ensureInitialized() {
  if (initialized) {
    return true;
  }

  const serviceAccount = parseServiceAccountJson();
  if (!serviceAccount) {
    return false;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  initialized = true;
  return true;
}

function normalizeTokens(tokens) {
  return [...new Set((tokens || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean))];
}

function shouldBroadcastEvent(event) {
  const status = String(event?.status || '').toUpperCase();
  const level = String(event?.level || '').toUpperCase();
  if (level === 'SOS' || level === 'WARNING') {
    return true;
  }
  return new Set([
    'REMINDER',
    'REMINDER_SENT',
    'CHECKIN_OVERDUE',
    'DEADMAN_LEVEL_1',
    'DEADMAN_LEVEL_2',
    'DEADMAN_LEVEL_3',
    'COMMUNITY_HELP_REQUESTED',
    'WARNING_TRIGGERED',
    'RESCUE_CALL_QUEUED',
    'VOLUNTEER_ACCEPTED',
    'SILENT_DURESS',
    'FALL_DETECTED',
    'SHAKE_SOS',
    'GEOFENCE_HOME_ARRIVAL',
    'AUTO_CHECKIN',
    'AUTO_WIPE_DUE',
    'VAULT_RELEASED',
  ]).has(status);
}

function detectEventKind(event) {
  const status = String(event?.status || '').toUpperCase();
  const level = String(event?.level || '').toUpperCase();
  const source = String(event?.source || '').toUpperCase();
  const actionType = String(event?.metadata?.actionType || '').toUpperCase();

  if (status === 'SILENT_DURESS' || level.includes('DURESS') || actionType === 'SILENT_DURESS') {
    return 'silent_sos';
  }
  if (
    status === 'SOS_BROADCASTED' ||
    status === 'COMMUNITY_HELP_REQUESTED' ||
    source.includes('rescue') ||
    actionType.includes('RESCUE')
  ) {
    return 'rescue_incident';
  }
  if (
    status === 'DEADMAN_LEVEL_3' ||
    status === 'DEADMAN_LEVEL_2' ||
    status === 'DEADMAN_LEVEL_1' ||
    status === 'CHECKIN_OVERDUE' ||
    status === 'REMINDER' ||
    status === 'REMINDER_SENT' ||
    status === 'WARNING_TRIGGERED' ||
    status === 'RESCUE_CALL_QUEUED' ||
    status === 'VOLUNTEER_ACCEPTED' ||
    level === 'WARNING'
  ) {
    return 'deadman';
  }
  if (status === 'FALL_DETECTED') {
    return 'fall_detected';
  }
  if (status === 'SHAKE_SOS') {
    return 'shake_sos';
  }
  if (status === 'GEOFENCE_HOME_ARRIVAL' || status === 'AUTO_CHECKIN') {
    return 'auto_checkin';
  }
  if (status === 'AUTO_WIPE_DUE') {
    return 'auto_wipe';
  }
  if (status === 'VAULT_RELEASED') {
    return 'vault_released';
  }
  return 'generic';
}

function buildPrettyCopy(event, role = 'victim') {
  const kind = detectEventKind(event);
  const status = String(event?.status || '').toUpperCase();
  const title = String(event?.title || '').trim();
  const message = String(event?.message || '').trim();
  const actor = role === 'guardian' ? 'Người được bảo hộ' : 'SafeSolo';

  const templates = {
    silent_sos: {
      guardian: {
        title: 'SOS thầm lặng',
        body: 'Người dùng đang ở tình huống có thể bị ép buộc. Mở SafeSolo ngay để kiểm tra vị trí và hỗ trợ.',
      },
      victim: {
        title: 'Đã ghi nhận tín hiệu an toàn',
        body: 'SafeSolo đang xử lý tín hiệu bảo vệ của bạn trong chế độ im lặng.',
      },
    },
    rescue_incident: {
      guardian: {
        title: 'Có ca cứu hộ mới',
        body: 'Một yêu cầu hỗ trợ cộng đồng vừa được tạo. Hãy vào ứng dụng để nhận nhiệm vụ hoặc theo dõi.',
      },
      victim: {
        title: 'Đang kết nối hỗ trợ',
        body: 'Yêu cầu trợ giúp của bạn đã được gửi đến cộng đồng hiệp sĩ.',
      },
    },
    deadman: {
      guardian: {
        title: 'Cảnh báo điểm danh',
        body: 'Người dùng đã chạm ngưỡng cảnh báo check-in. Vui lòng kiểm tra trạng thái ngay.',
      },
      victim: {
        title: 'Nhắc điểm danh',
        body: 'Đã đến khung thời gian xác nhận an toàn. Bấm vào SafeSolo để điểm danh.',
      },
    },
    deadman_reminder: {
      guardian: {
        title: 'Nhắc điểm danh',
        body: 'SafeSolo vừa gửi nhắc nhở check-in đến người dùng.',
      },
      victim: {
        title: 'Nhắc điểm danh',
        body: 'Đã đến lúc xác nhận bạn vẫn an toàn.',
      },
    },
    deadman_warning: {
      guardian: {
        title: 'Cảnh báo khẩn',
        body: 'Người dùng đã quá hạn check-in. Hệ thống đang nâng mức cảnh báo.',
      },
      victim: {
        title: 'Cảnh báo quá hạn',
        body: 'Bạn đã quá hạn check-in, vui lòng phản hồi ngay.',
      },
    },
    rescue_call: {
      guardian: {
        title: 'Đã sẵn sàng cứu hộ',
        body: 'Hệ thống đã chuyển ca sang hàng đợi gọi cứu hộ và hiệp sĩ.',
      },
      victim: {
        title: 'Đang gọi hỗ trợ',
        body: 'SafeSolo đã chuyển sự cố của bạn sang hàng đợi cứu hộ.',
      },
    },
    volunteer_accepted: {
      guardian: {
        title: 'Hiệp sĩ đã nhận ca',
        body: 'Một hiệp sĩ KYC đã nhận nhiệm vụ hỗ trợ. Vui lòng theo dõi diễn biến.',
      },
      victim: {
        title: 'Có người đang hỗ trợ',
        body: 'Một hiệp sĩ đã nhận ca cứu hộ và đang tiếp cận bạn.',
      },
    },
    fall_detected: {
      guardian: {
        title: 'Phát hiện té ngã',
        body: 'Thiết bị gửi tín hiệu nghi ngờ té ngã. Hãy kiểm tra người dùng càng sớm càng tốt.',
      },
      victim: {
        title: 'Đã ghi nhận chuyển động bất thường',
        body: 'SafeSolo đang theo dõi tín hiệu an toàn trên thiết bị của bạn.',
      },
    },
    shake_sos: {
      guardian: {
        title: 'SOS từ lắc máy',
        body: 'Thiết bị kích hoạt tín hiệu SOS từ chuyển động. Mở SafeSolo để xem chi tiết.',
      },
      victim: {
        title: 'Đã gửi tín hiệu SOS',
        body: 'SafeSolo đã ghi nhận yêu cầu hỗ trợ khẩn cấp của bạn.',
      },
    },
    auto_checkin: {
      guardian: {
        title: 'Tự check-in thành công',
        body: 'Người dùng vừa quay về vùng an toàn và hệ thống đã cập nhật điểm danh.',
      },
      victim: {
        title: 'Điểm danh tự động',
        body: 'SafeSolo đã xác nhận bạn đang ở vùng an toàn.',
      },
    },
    auto_wipe: {
      guardian: {
        title: 'Auto-wipe đã kích hoạt',
        body: 'Hệ thống đã xoá dữ liệu nhạy cảm cục bộ theo chính sách an toàn.',
      },
      victim: {
        title: 'Đã bảo vệ dữ liệu',
        body: 'SafeSolo đã xử lý chính sách auto-wipe trên thiết bị.',
      },
    },
    vault_released: {
      guardian: {
        title: 'Két sinh tử đã mở',
        body: 'Dữ liệu két sinh tử đã được giải mã và sẵn sàng cho người được uỷ quyền.',
      },
      victim: {
        title: 'Két sinh tử đã được cập nhật',
        body: 'SafeSolo đã ghi nhận trạng thái mới của két sinh tử.',
      },
    },
    generic: {
      guardian: {
        title: title || 'SafeSolo cảnh báo',
        body: message || `Cảnh báo từ ${actor.toLowerCase()}: ${status || 'đã cập nhật'}.`,
      },
      victim: {
        title: title || 'SafeSolo cập nhật',
        body: message || `Trạng thái của bạn: ${status || 'đã cập nhật'}.`,
      },
    },
  };

  const copy = templates[kind]?.[role] || templates.generic[role];
  if (kind === 'deadman' && status === 'REMINDER_SENT') {
    return {
      notification: {
        title: `SafeSolo · ${templates.deadman_reminder[role].title}`,
        body: templates.deadman_reminder[role].body,
      },
    };
  }
  if (kind === 'deadman' && status === 'WARNING_TRIGGERED') {
    return {
      notification: {
        title: `SafeSolo · ${templates.deadman_warning[role].title}`,
        body: templates.deadman_warning[role].body,
      },
    };
  }
  if (kind === 'deadman' && status === 'RESCUE_CALL_QUEUED') {
    return {
      notification: {
        title: `SafeSolo · ${templates.rescue_call[role].title}`,
        body: templates.rescue_call[role].body,
      },
    };
  }
  if (kind === 'deadman' && status === 'VOLUNTEER_ACCEPTED') {
    return {
      notification: {
        title: `SafeSolo · ${templates.volunteer_accepted[role].title}`,
        body: templates.volunteer_accepted[role].body,
      },
    };
  }
  return {
    notification: {
      title: `SafeSolo · ${copy.title}`,
      body: copy.body,
    },
  };
}

function buildNotificationPayload(event, role = 'victim') {
  return buildPrettyCopy(event, role);
}

function buildDataPayload(event, role = 'victim') {
  return {
    type: 'alert_event',
    role,
    eventId: String(event?.id || event?._id || ''),
    userId: String(event?.userId || ''),
    level: String(event?.level || ''),
    status: String(event?.status || ''),
    source: String(event?.source || ''),
  };
}

async function registerPushToken(userId, token) {
  if (!userId || !token) {
    return null;
  }

  await User.updateOne(
    { _id: userId },
    {
      $addToSet: {
        pushTokens: String(token).trim(),
      },
    },
  );

  return true;
}

async function removePushToken(userId, token) {
  if (!userId || !token) {
    return null;
  }

  await User.updateOne(
    { _id: userId },
    {
      $pull: {
        pushTokens: String(token).trim(),
      },
    },
  );

  return true;
}

async function getVictimTokens(userId) {
  const user = await User.findById(userId).lean();
  return {
    user,
    tokens: normalizeTokens(user?.pushTokens || []),
  };
}

async function getGuardianTokens(userId) {
  const relationships = await GuardianRelationship.find({
    requesterId: userId,
    status: 'ACCEPTED',
  }).lean();
  const guardianIds = [...new Set(relationships.map((item) => item.guardianId))];
  const guardians = guardianIds.length
    ? await User.find({ _id: { $in: guardianIds }, isActive: { $ne: false } }).lean()
    : [];
  const guardianMap = new Map(guardians.map((item) => [item._id, item]));
  const tokens = [];
  for (const relationship of relationships) {
    const guardian = guardianMap.get(relationship.guardianId);
    if (!guardian) {
      continue;
    }
    tokens.push(...normalizeTokens(guardian.pushTokens || []));
  }
  return normalizeTokens(tokens);
}

async function sendMulticast(tokens, event, role = 'victim') {
  const safeTokens = normalizeTokens(tokens);
  if (!safeTokens.length || !isConfigured() || !ensureInitialized()) {
    return {
      skipped: true,
      reason: 'FCM not configured',
      tokens: safeTokens.length,
    };
  }

  const payload = {
    tokens: safeTokens,
    ...buildNotificationPayload(event, role),
    data: buildDataPayload(event, role),
  };

  const response = await admin.messaging().sendEachForMulticast(payload);
  return {
    skipped: false,
    successCount: response.successCount,
    failureCount: response.failureCount,
    responses: response.responses.map((item) => ({
      success: item.success,
      messageId: item.messageId || null,
      error: item.error ? item.error.message : null,
    })),
  };
}

async function sendAlertFanout(event) {
  if (!event || !shouldBroadcastEvent(event)) {
    return { skipped: true, reason: 'Event not eligible for push' };
  }

  const victimTokens = (await getVictimTokens(event.userId)).tokens;
  const guardianTokens = await getGuardianTokens(event.userId);
  if (!victimTokens.length && !guardianTokens.length) {
    return { skipped: true, reason: 'No push tokens registered' };
  }

  const results = {};
  if (victimTokens.length) {
    results.victim = await sendMulticast(victimTokens, event, 'victim');
  }
  if (guardianTokens.length) {
    results.guardian = await sendMulticast(guardianTokens, event, 'guardian');
  }

  return results;
}

async function sendDirectToUser(userId, event) {
  const { tokens } = await getVictimTokens(userId);
  return sendMulticast(tokens, event, 'victim');
}

module.exports = {
  ensureInitialized,
  isConfigured,
  registerPushToken,
  removePushToken,
  sendAlertFanout,
  sendDirectToUser,
};
