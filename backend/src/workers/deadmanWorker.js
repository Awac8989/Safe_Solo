const User = require('../models/User');
const SecuritySetting = require('../models/SecuritySetting');
const { triggerSosForUser } = require('../services/sosService');
const { createAlertEvent } = require('../services/alertEventService');
const { ensureAlertPolicy } = require('../services/alertPolicyService');
const vaultService = require('../services/vaultService');
const { mapUserDoc } = require('../lib/mongoCore');

function toMinutes(ms) {
  return Math.floor(ms / 60000);
}

function toMinuteOfDay(time) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return hour * 60 + minute;
}

function isInQuietHours(now, start, end) {
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const startMinute = toMinuteOfDay(start || '23:00');
  const endMinute = toMinuteOfDay(end || '06:00');

  if (startMinute === endMinute) {
    return false;
  }
  if (startMinute < endMinute) {
    return nowMinute >= startMinute && nowMinute < endMinute;
  }
  return nowMinute >= startMinute || nowMinute < endMinute;
}

function isSleepModeActive(now, sleepUntilIso) {
  if (!sleepUntilIso) {
    return false;
  }
  return new Date(sleepUntilIso) > now;
}

function startDeadManWorker(io) {
  const workerInterval = Number(process.env.WORKER_INTERVAL_MS || 60000);
  const defaultReminderMinutes = Number(process.env.ESCALATION_REMINDER_MINUTES || 30);
  const defaultWarningMinutes = Number(process.env.ESCALATION_WARNING_MINUTES || 5);
  const defaultSosMinutes = Number(process.env.ESCALATION_SOS_MINUTES || 15);

  setInterval(async () => {
    try {
      const users = await User.find({ role: 'user' }).sort({ updatedAt: -1 });
      const now = new Date();

      for (const userDoc of users) {
        const user = mapUserDoc(userDoc);
        const policy = await ensureAlertPolicy(user._id);
        const deadline = new Date(user.nextDeadline);
        const msUntilDeadline = deadline.getTime() - now.getTime();
        const minutesUntilDeadline = toMinutes(msUntilDeadline);
        const overdueMinutes = toMinutes(-msUntilDeadline);
        const grace = Number(user.falseAlertGraceMinutes || 0);
        const reminderMinutes = Number(policy?.level1Minutes || defaultReminderMinutes);
        const warningMinutes = Number(policy?.level2Minutes || defaultWarningMinutes);
        const sosMinutes = Number(policy?.level3Minutes || defaultSosMinutes);
        const inQuietHours = isInQuietHours(now, user.quietHoursStart, user.quietHoursEnd);
        const sleepModeActive = isSleepModeActive(now, user.sleepModeUntil);
        const security = await SecuritySetting.findOne({ userId: user._id });

        if (inQuietHours || sleepModeActive) {
          continue;
        }

        if (
          security?.autoWipeDays > 0 &&
          user.lastCheckinTime &&
          (!security.lastAutoWipeDueAt || new Date(security.lastAutoWipeDueAt) < new Date(user.lastCheckinTime)) &&
          now.getTime() >= new Date(user.lastCheckinTime).getTime() + security.autoWipeDays * 24 * 60 * 60 * 1000
        ) {
          security.lastAutoWipeDueAt = now;
          await security.save();

          const event = await createAlertEvent({
            userId: user._id,
            level: 'INFO',
            status: 'AUTO_WIPE_DUE',
            source: 'SYSTEM',
            title: 'Auto-wipe den han',
            message: `Da qua ${security.autoWipeDays} ngay khong co check-in. Thiet bi co the thuc thi xoa du lieu nhay cam cuc bo.`,
            metadata: { autoWipeDays: security.autoWipeDays, lastCheckinTime: user.lastCheckinTime },
          });
          io.emit('ALERT_EVENT', event);
        }

        if (
          minutesUntilDeadline <= reminderMinutes &&
          minutesUntilDeadline >= 0 &&
          (!user.lastReminderAt || new Date(user.lastReminderAt) < new Date(user.lastCheckinTime))
        ) {
          userDoc.currentStatus = 'REMINDER';
          userDoc.lastReminderAt = now;
          await userDoc.save();

          io.emit('CHECKIN_REMINDER', {
            userId: user._id,
            fullName: user.fullName,
            nextDeadline: user.nextDeadline,
            message: 'Sap den han check-in',
          });

          const event = await createAlertEvent({
            userId: user._id,
            level: 'LEVEL_1_REMINDER',
            status: 'REMINDER_SENT',
            source: 'SYSTEM',
            title: 'Nhac nho check-in',
            message: 'Sap den han check-in, vui long xac nhan ban an toan',
            metadata: { nextDeadline: user.nextDeadline },
          });
          io.emit('ALERT_EVENT', event);
          continue;
        }

        if (
          overdueMinutes >= warningMinutes + grace &&
          overdueMinutes < sosMinutes + grace &&
          user.currentStatus !== 'WARNING'
        ) {
          userDoc.currentStatus = 'WARNING';
          userDoc.lastWarningAt = now;
          await userDoc.save();

          io.emit('CHECKIN_WARNING', {
            userId: user._id,
            fullName: user.fullName,
            overdueMinutes,
            message: 'Da qua han check-in, kich hoat canh bao cap 1',
          });

          const event = await createAlertEvent({
            userId: user._id,
            level: 'LEVEL_2_ALARM',
            status: 'WARNING_TRIGGERED',
            source: 'SYSTEM',
            title: 'Canh bao muc 2',
            message: 'Nguoi dung da qua han check-in, da kich hoat canh bao',
            metadata: { overdueMinutes },
          });
          io.emit('ALERT_EVENT', event);
          continue;
        }

        if (overdueMinutes >= sosMinutes + grace && user.currentStatus !== 'SOS') {
          await triggerSosForUser(io, user);
          if (policy?.level4Enabled && overdueMinutes >= sosMinutes + grace + 10) {
            const event = await createAlertEvent({
              userId: user._id,
              level: 'LEVEL_4_RESCUE_CALL',
              status: 'RESCUE_CALL_QUEUED',
              source: 'SYSTEM',
              title: 'Kich hoat goi cuu ho',
              message: 'Vuot nguong SOS, da dua vao hang doi auto-call',
              metadata: { overdueMinutes, policy },
            });
            io.emit('ALERT_EVENT', event);
          }
        }

        // MỤC 6.3: Tự động mở Két sinh tử & gửi cho Người bảo hộ khi mất liên lạc 72h (72 * 60 = 4320 phút)
        const vaultThresholdMinutes = 72 * 60;
        if (overdueMinutes >= vaultThresholdMinutes && !userDoc.vaultReleasedAt) {
          userDoc.vaultReleasedAt = now;
          await userDoc.save();

          const releaseResult = await vaultService.releaseVaultToGuardians(user._id);
          const vaultEvent = await createAlertEvent({
            userId: user._id,
            level: 'VAULT_72H_RELEASE',
            status: 'VAULT_UNLOCKED_SENT_TO_GUARDIANS',
            source: 'SYSTEM',
            title: 'Tự động mở Két sinh tử sau 72h mất liên lạc',
            message: `Người dùng mất liên lạc quá 72 giờ (${overdueMinutes} phút). Hệ thống đã tự động mở Két sinh tử và gửi thông báo khẩn cấp tới danh sách Người bảo hộ.`,
            metadata: { overdueMinutes, releaseResult },
          });
          io.emit('ALERT_EVENT', vaultEvent);
          io.emit('VAULT_EMERGENCY_RELEASED', {
            userId: user._id,
            releasedAt: now,
            overdueMinutes,
          });
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('DeadMan worker failed:', error.message);
    }
  }, workerInterval);

  // eslint-disable-next-line no-console
  console.log(`DeadMan worker started, interval=${workerInterval}ms`);
}

module.exports = { startDeadManWorker };
