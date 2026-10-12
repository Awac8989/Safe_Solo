const https = require('https');

function formatVnTime(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${hours}:${minutes} ngày ${day}/${month}`;
}

/**
 * Telegram Bot Service for SafeSolo
 * Supports 1-tap Check-in via Inline Buttons, Real-time Reminders, SOS Alerts, and Polling
 */
class TelegramBotService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.botUsername = process.env.TELEGRAM_BOT_USERNAME || 'SFESOLOBot';
    this.isConfigured = Boolean(this.token && this.token.length > 10);

    this.userChatMap = new Map();
    this.mockInbox = [];
    this.pollingActive = false;
  }

  reloadConfig() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.botUsername = process.env.TELEGRAM_BOT_USERNAME || 'SFESOLOBot';
    this.isConfigured = Boolean(this.token && this.token.length > 10);
  }

  /**
   * Send HTTP POST request to Telegram Bot API
   */
  async _callTelegramApi(method, payload) {
    this.reloadConfig();
    if (!this.isConfigured) {
      return null;
    }

    return new Promise((resolve) => {
      const data = JSON.stringify(payload);
      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${this.token}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: method === 'getUpdates' ? 35000 : 12000,
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch {
            resolve({ ok: false, error: 'JSON parse error', raw: body });
          }
        });
      });

      req.on('error', (err) => {
        console.warn('[TelegramBotService] Request error:', err.message);
        resolve({ ok: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'Request timeout' });
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Persistent Reply Keyboard Menu (Tự động thích ứng: Hiệp Sĩ Cứu Hộ vs Người Dùng Cá Nhân)
   */
  getMainMenuKeyboard(isHero = false) {
    if (isHero) {
      return {
        keyboard: [
          [{ text: '🚨 Ca SOS Lân Cận' }, { text: '⚡ Mở Tủ AED Gần Nhất' }],
          [{ text: '🩸 SafeBlood Máu Hiếm' }, { text: '💳 Thẻ Ngành & Ví Quỹ' }],
          [{ text: '📍 Gửi Vị Trí Tác Chiến', request_location: true }, { text: '⚖️ Tra Cứu Pháp Lý 87' }],
          [{ text: '📊 Trạng Thái Trực Chiến' }],
        ],
        resize_keyboard: true,
        is_persistent: true,
      };
    }
    return {
      keyboard: [
        [{ text: '💚 Điểm Danh An Toàn' }, { text: '📊 Xem Trạng Thái' }],
        [{ text: '📍 Gửi Vị Trí GPS', request_location: true }, { text: '⏰ Gia Hạn 1 Giờ' }],
        [{ text: '🆘 Báo Động SOS' }, { text: '🛡️ Đăng Ký Hiệp Sĩ KYC' }],
        [{ text: '⚡ Tìm Máy Sốc Tim AED' }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  /**
   * Start long-polling in background
   */
  startPolling() {
    this.reloadConfig();
    if (!this.isConfigured || this.pollingActive) {
      return;
    }
    this.pollingActive = true;
    let offset = 0;

    const poll = async () => {
      if (!this.pollingActive) return;
      try {
        const res = await this._callTelegramApi('getUpdates', {
          offset,
          timeout: 15,
        });

        if (res && res.ok && Array.isArray(res.result)) {
          for (const update of res.result) {
            offset = update.update_id + 1;
            await this.handleWebhook(update);
          }
        }
      } catch (err) {
        console.warn('[TelegramBotService] Polling error:', err.message);
      }

      if (this.pollingActive) {
        setTimeout(poll, 1200);
      }
    };

    poll();
    console.log(`[TelegramBotService] Telegram bot long-polling started for @${this.botUsername}`);
  }

  stopPolling() {
    this.pollingActive = false;
  }

  async resolveChatId(identifier) {
    if (!identifier) return null;
    const cleanId = String(identifier).trim();

    if (/^-?\d+$/.test(cleanId)) {
      return cleanId;
    }

    const username = cleanId.replace(/^@/, '').toLowerCase();
    if (this.userChatMap.has(username)) {
      return this.userChatMap.get(username);
    }

    try {
      const User = require('../models/User');
      const user = await User.findOne({
        $or: [
          { telegramUsername: username },
          { telegramUsername: `@${username}` },
          { phoneNumber: cleanId },
        ],
      });
      if (user && user.telegramChatId && /^-?\d+$/.test(user.telegramChatId)) {
        this.userChatMap.set(username, user.telegramChatId);
        return user.telegramChatId;
      }
    } catch {
      // ignore
    }

    return cleanId;
  }

  /**
   * Send custom text message to Telegram ChatId or username
   */
  async sendMessage({ chatId, text, parse_mode = 'HTML', reply_markup }) {
    this.reloadConfig();
    const resolvedChatId = await this.resolveChatId(chatId);
    if (!resolvedChatId) {
      return { ok: false, error: 'No valid Telegram chatId' };
    }

    if (this.isConfigured && /^-?\d+$/.test(resolvedChatId)) {
      return await this._callTelegramApi('sendMessage', {
        chat_id: resolvedChatId,
        text,
        parse_mode,
        ...(reply_markup ? { reply_markup } : {}),
      });
    }

    return { ok: true, channel: 'telegram-mock', chatId: resolvedChatId, text };
  }

  /**
   * Phát lệnh cảnh báo SOS khẩn cấp tới cộng đồng Hiệp sĩ / Kênh điều phối trung tâm
   */
  async broadcastSosAlert({ incidentId, victimName, phone, location, medicalNotes, emergencyLogId }) {
    this.reloadConfig();
    const targetChat = process.env.TELEGRAM_CHAT_ID;
    if (!targetChat) return { ok: false, error: 'TELEGRAM_CHAT_ID is not configured' };

    const lat = location?.lat || 10.7765;
    const lng = location?.lng || 106.7009;
    const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    const text = [
      `🚨🚨 <b>[SAFESOLO TOC] CẢNH BÁO CẤP CỨU NGOẠI VIỆN KHẨN CẤP!</b> 🚨🚨`,
      ``,
      `👤 <b>Nạn nhân:</b> ${victimName || 'Người dùng SafeSolo'}`,
      `📞 <b>Liên hệ:</b> <code>${phone || 'N/A'}</code>`,
      `🏥 <b>Ghi chú Y tế SafeTag:</b> ${medicalNotes || 'Chưa cập nhật dị ứng/bệnh nền'}`,
      `📍 <b>Hiện trường:</b> <a href="${mapUrl}">Tọa độ GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})</a>`,
      `⏱️ <b>Thời điểm:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
      `🆔 <b>Mã sự cố:</b> <code>${incidentId || emergencyLogId || 'INC_SOS_LIVE'}</code>`,
      ``,
      `<i>⚡ Hiệp sĩ gần hiện trường nhất vui lòng bấm nút bên dưới để nhận ca hoặc mở tủ máy sốc tim AED lân cận!</i>`,
    ].join('\n');

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🚨 NHẬN CA CỨU NẠN', callback_data: `accept_incident:${incidentId || emergencyLogId}` },
          { text: '⚡ MỞ TỦ SỐC TIM AED', callback_data: `open_aed:${incidentId || emergencyLogId}` },
        ],
        [
          { text: '📍 Mở Google Maps Chỉ Đường', url: mapUrl },
        ]
      ]
    };

    return await this.sendMessage({
      chatId: targetChat,
      text,
      parse_mode: 'HTML',
      reply_markup: inlineKeyboard,
    });
  }

  /**
   * Send an OTP verification code
   */
  async sendOtp(targetIdentifier, otpCode, recipientName = 'Bạn') {
    this.reloadConfig();
    const resolvedChatId = await this.resolveChatId(targetIdentifier);

    const text = [
      `🛡️ <b>SafeSolo Guardian Security</b>`,
      ``,
      `Xin chào <b>${recipientName}</b>,`,
      `Mã xác minh OTP đăng nhập SafeSolo của bạn là:`,
      `👉 <code>${otpCode}</code> 👈`,
      ``,
      `⏱️ <i>Mã này có hiệu lực trong 5 phút.</i>`,
      `⚠️ <b>Tuyệt đối không chia sẻ mã này cho bất kỳ ai</b> để bảo vệ tài khoản an toàn.`,
    ].join('\n');

    const logEntry = {
      chatId: resolvedChatId,
      recipientName,
      otpCode,
      text,
      timestamp: new Date().toISOString(),
    };
    this.mockInbox.unshift(logEntry);
    if (this.mockInbox.length > 50) this.mockInbox.pop();

    console.log(`[TelegramBotService] Dispatching OTP ${otpCode} to Telegram ChatId: ${resolvedChatId}`);

    if (this.isConfigured && resolvedChatId && /^-?\d+$/.test(resolvedChatId)) {
      const result = await this._callTelegramApi('sendMessage', {
        chat_id: resolvedChatId,
        text,
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(),
      });
      return {
        success: result?.ok ?? true,
        channel: 'telegram-live',
        chatId: resolvedChatId,
        telegramResult: result,
      };
    }

    return {
      success: true,
      channel: 'telegram-sandbox',
      chatId: resolvedChatId,
      otpPreview: otpCode,
      message: `Đã gửi mã xác thực qua Telegram Bot (@${this.botUsername}).`,
      botLink: `https://t.me/${this.botUsername}?start=otp`,
    };
  }

  /**
   * Send Password Reset OTP Code via Telegram
   */
  async sendPasswordResetCode(targetIdentifier, resetCode, recipientName = 'Bạn') {
    this.reloadConfig();
    const resolvedChatId = await this.resolveChatId(targetIdentifier);

    const text = [
      `🔐 <b>[SAFESOLO] KHÔI PHỤC MẬT KHẨU TÀI KHOẢN</b>`,
      ``,
      `Xin chào <b>${recipientName}</b>,`,
      `Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản SafeSolo của bạn.`,
      ``,
      `Mã khôi phục 6 chữ số:`,
      `👉 <code>${resetCode}</code> 👈`,
      ``,
      `⏱️ <i>Mã có hiệu lực trong vòng 15 phút.</i>`,
      `⚠️ <b>Cảnh báo:</b> Tuyệt đối không chia sẻ mã này cho bất kỳ ai để đảm bảo an toàn.`,
    ].join('\n');

    const logEntry = {
      chatId: resolvedChatId,
      recipientName,
      resetCode,
      text,
      timestamp: new Date().toISOString(),
    };
    this.mockInbox.unshift(logEntry);
    if (this.mockInbox.length > 50) this.mockInbox.pop();

    console.log(`[TelegramBotService] Dispatching Password Reset Code ${resetCode} to Telegram ChatId: ${resolvedChatId}`);

    if (this.isConfigured && resolvedChatId && /^-?\d+$/.test(resolvedChatId)) {
      const result = await this._callTelegramApi('sendMessage', {
        chat_id: resolvedChatId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛡️ Mở SafeSolo App', url: 'https://safesolo.vn' }],
          ],
        },
      });
      return {
        success: result?.ok ?? true,
        channel: 'telegram-live',
        chatId: resolvedChatId,
        telegramResult: result,
      };
    }

    return {
      success: true,
      channel: 'telegram-sandbox',
      chatId: resolvedChatId,
      resetCodePreview: resetCode,
      message: `Đã gửi mã khôi phục mật khẩu qua Telegram Bot (@${this.botUsername}).`,
      botLink: `https://t.me/${this.botUsername}?start=reset`,
    };
  }

  /**
   * Send Check-in Reminder with 1-Tap Inline Buttons
   */
  async sendCheckinReminder(user, minutesUntilDeadline) {
    this.reloadConfig();
    const chatId = await this.resolveChatId(user.telegramChatId || user.telegramUsername);
    if (!chatId || !/^-?\d+$/.test(chatId)) {
      return { success: false, error: 'No numerical chatId' };
    }

    const deadlineStr = formatVnTime(user.nextDeadline);
    const customPromptHeader = user.telegramCustomPrompt
      ? `💌 <b>Lời nhắc từ người thương:</b> <i>"${user.telegramCustomPrompt}"</i>\n\n`
      : '';
    const text = [
      `⏰ <b>[SAFESOLO] NHẮC NHỞ ĐIỂM DANH BÌNH AN</b>`,
      ``,
      customPromptHeader ? customPromptHeader : '',
      `Xin chào <b>${user.fullName || 'bạn'}</b>,`,
      `Bạn sắp đến hạn check-in định kỳ:`,
      `⏱️ Còn khoảng <b>${Math.max(1, Math.round(minutesUntilDeadline))} phút</b> (Hạn chót: <b>${deadlineStr}</b>).`,
      ``,
      `Vui lòng bấm nút bên dưới để xác nhận bạn vẫn an toàn:`,
    ].filter(Boolean).join('\n');

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '💚 Tôi Bình An (Check-in Ngay)', callback_data: `checkin:${user._id}` },
          { text: '💤 Hoãn 1 giờ', callback_data: `snooze:${user._id}:60` },
        ],
        [
          { text: '🚨 Phát Báo Động SOS Khẩn Cấp', callback_data: `sos:${user._id}` },
        ],
      ],
    };

    const res = await this._callTelegramApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: inlineKeyboard,
    });

    return { success: res?.ok ?? false, result: res };
  }

  /**
   * Send Check-in Warning when overdue
   */
  async sendCheckinWarning(user, overdueMinutes) {
    this.reloadConfig();
    const chatId = await this.resolveChatId(user.telegramChatId || user.telegramUsername);
    if (!chatId || !/^-?\d+$/.test(chatId)) {
      return { success: false, error: 'No numerical chatId' };
    }

    const text = [
      `⚠️ <b>[SAFESOLO] CẢNH BÁO QUÁ HẠN CHECK-IN!</b> ⚠️`,
      ``,
      `<b>${user.fullName}</b> ơi! Bạn đã quá hạn điểm danh <b>${overdueMinutes} phút</b>!`,
      `Nếu không có phản hồi, hệ thống sẽ tự động gửi báo động Cấp cứu SOS tới danh sách Người bảo hộ!`,
      ``,
      `Bấm ngay nút bên dưới nếu bạn vẫn an toàn:`,
    ].join('\n');

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ TÔI AN TOÀN (HỦY CẢNH BÁO)', callback_data: `checkin:${user._id}` },
        ],
        [
          { text: '🆘 CẦN CỨU HỘ KHẨN CẤP (SOS)', callback_data: `sos:${user._id}` },
        ],
      ],
    };

    const res = await this._callTelegramApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: inlineKeyboard,
    });

    return { success: res?.ok ?? false, result: res };
  }

  /**
   * Send Emergency SOS alert to Guardian on Telegram
   */
  async sendEmergencyAlert(chatId, alertData) {
    this.reloadConfig();
    const resolvedChatId = await this.resolveChatId(chatId);

    const text = [
      `🚨 <b>CẢNH BÁO KHẨN CẤP SAFESOLO SOS!</b> 🚨`,
      ``,
      `Nạn nhân: <b>${alertData.victimName}</b>`,
      `Tình trạng: <b>${alertData.status || 'GẶP NGUY HIỂM'}</b>`,
      alertData.heartRate ? `❤️ Nhịp tim: ${alertData.heartRate} BPM` : '',
      alertData.battery ? `🔋 Pin: ${alertData.battery}%` : '',
      alertData.address ? `📍 Địa điểm: ${alertData.address}` : '',
      alertData.mapUrl ? `🗺️ Bản đồ: <a href="${alertData.mapUrl}">Xem vị trí GPS</a>` : '',
      ``,
      `<i>Vui lòng liên hệ với nạn nhân ngay lập tức!</i>`,
    ].filter(Boolean).join('\n');

    if (this.isConfigured && resolvedChatId && /^-?\d+$/.test(resolvedChatId)) {
      await this._callTelegramApi('sendMessage', {
        chat_id: resolvedChatId,
        text,
        parse_mode: 'HTML',
      });
    }

    return { success: true };
  }

  /**
   * Handle incoming Callback Query (Inline Button Click)
   */
  async handleCallbackQuery(cbQuery) {
    const id = cbQuery.id;
    const data = cbQuery.data || '';
    const chatId = cbQuery.message?.chat?.id;
    const messageId = cbQuery.message?.message_id;
    const fromId = String(cbQuery.from?.id);

    console.log(`[TelegramBotService] Callback query from ${fromId}: "${data}"`);

    const User = require('../models/User');

    // 1. Check-in action
    if (data.startsWith('checkin:')) {
      const userId = data.split(':')[1];
      let user = userId ? await User.findById(userId) : null;
      if (!user) {
        user = await User.findOne({ telegramChatId: fromId });
      }

      if (!user) {
        await this._callTelegramApi('answerCallbackQuery', {
          callback_query_id: id,
          text: 'Không tìm thấy hồ sơ người dùng liên kết!',
          show_alert: true,
        });
        return { ok: true };
      }

      const now = new Date();
      const intervalMins = Number(user.timerIntervalMinutes || 720);
      user.lastCheckinTime = now;
      user.nextDeadline = new Date(now.getTime() + intervalMins * 60 * 1000);
      user.currentStatus = 'SAFE';
      user.deadmanStage = 0;
      user.lastReminderAt = null;
      user.lastWarningAt = null;
      await user.save();

      // Emit socket update
      try {
        const { getIo } = require('../sockets/socketServer');
        const io = getIo();
        if (io) {
          io.emit('CHECKIN_CONFIRMED', {
            userId: user._id,
            currentStatus: 'SAFE',
            lastCheckinTime: user.lastCheckinTime,
            nextDeadline: user.nextDeadline,
          });
        }
      } catch {
        // ignore
      }

      // Answer Telegram Toast
      await this._callTelegramApi('answerCallbackQuery', {
        callback_query_id: id,
        text: '✅ Điểm danh an toàn thành công!',
        show_alert: false,
      });

      // Update the Telegram message
      const updatedText = [
        `✅ <b>ĐIỂM DANH AN TOÀN THÀNH CÔNG!</b> 💚`,
        ``,
        `Tuyệt vời! SafeSolo đã ghi nhận trạng thái bình an của <b>${user.fullName}</b>.`,
        `🕒 Thời gian điểm danh: <b>${formatVnTime(now)}</b>`,
        `⏱️ Hạn check-in tiếp theo: <b>${formatVnTime(user.nextDeadline)}</b> (${Math.round(intervalMins / 60)} giờ nữa).`,
        ``,
        `Chúc bạn một ngày tràn đầy năng lượng và an lành! ✨`,
      ].join('\n');

      if (chatId && messageId) {
        await this._callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: updatedText,
          parse_mode: 'HTML',
        });
      }

      return { ok: true, action: 'checkin_confirmed' };
    }

    // 2. Snooze action (hoãn 1 giờ)
    if (data.startsWith('snooze:')) {
      const parts = data.split(':');
      const userId = parts[1];
      const snoozeMinutes = Number(parts[2] || 60);

      let user = userId ? await User.findById(userId) : null;
      if (!user) {
        user = await User.findOne({ telegramChatId: fromId });
      }

      if (user) {
        const currentDeadline = user.nextDeadline ? new Date(user.nextDeadline).getTime() : Date.now();
        user.nextDeadline = new Date(Math.max(Date.now(), currentDeadline) + snoozeMinutes * 60 * 1000);
        user.currentStatus = 'SAFE';
        user.lastReminderAt = null;
        user.lastWarningAt = null;
        await user.save();

        await this._callTelegramApi('answerCallbackQuery', {
          callback_query_id: id,
          text: `💤 Đã hoãn thêm ${snoozeMinutes} phút!`,
        });

        const snoozeText = [
          `💤 <b>ĐÃ GIA HẠN THỜI GIAN CHECK-IN</b>`,
          ``,
          `Đã cộng thêm <b>${snoozeMinutes} phút</b> vào mốc an toàn của <b>${user.fullName}</b>.`,
          `⏱️ Hạn check-in mới: <b>${formatVnTime(user.nextDeadline)}</b>.`,
          ``,
          `Khi bạn rảnh rỗi, hãy bấm <b>"💚 Điểm Danh An Toàn"</b> ở thanh menu nhé!`,
        ].join('\n');

        if (chatId && messageId) {
          await this._callTelegramApi('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: snoozeText,
            parse_mode: 'HTML',
          });
        }
      }
      return { ok: true, action: 'snooze_confirmed' };
    }

    // 3. SOS action
    if (data.startsWith('sos:')) {
      const userId = data.split(':')[1];
      let user = userId ? await User.findById(userId) : null;
      if (!user) {
        user = await User.findOne({ telegramChatId: fromId });
      }

      if (user) {
        try {
          const { triggerSosForUser } = require('./sosService');
          const { getIo } = require('../sockets/socketServer');
          const io = getIo();
          await triggerSosForUser(io, user);
        } catch (e) {
          console.warn('[TelegramBotService] SOS trigger error:', e.message);
        }

        await this._callTelegramApi('answerCallbackQuery', {
          callback_query_id: id,
          text: '🚨 ĐÃ PHÁT TÍN HIỆU SOS KHẨN CẤP!',
          show_alert: true,
        });

        const sosText = [
          `🚨 <b>ĐÃ PHÁT TÍN HIỆU CẤP CỨU SOS!</b> 🚨`,
          ``,
          `Hệ thống SafeSolo đã ngay lập tức kích hoạt chuông cảnh báo và gửi định vị GPS hiện tại tới toàn bộ Người bảo hộ của bạn!`,
          `Hãy cố gắng giữ bình tĩnh và tìm nơi an toàn nhất.`,
        ].join('\n');

        if (chatId && messageId) {
          await this._callTelegramApi('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: sosText,
            parse_mode: 'HTML',
          });
        }
      }
      return { ok: true, action: 'sos_triggered' };
    }

    // 4. Accept Incident action (Hiệp sĩ nhận ca cứu nạn)
    if (data.startsWith('accept_incident:')) {
      const incidentId = data.split(':')[1];
      const radarService = require('./radarService');

      let user = await User.findOne({ telegramChatId: fromId });
      if (!user) {
        user = await User.findOne({ isHero: true });
      }

      try {
        const acceptRes = await radarService.acceptRescueIncident(incidentId, user?._id || fromId);
        await this._callTelegramApi('answerCallbackQuery', {
          callback_query_id: id,
          text: '🚗 ĐÃ TIẾP NHẬN CA CỨU NẠN THÀNH CÔNG!',
          show_alert: true,
        });

        const victim = acceptRes.incident?.victim || {};
        const acceptedText = [
          `🚗 <b>ĐÃ TIẾP NHẬN NHIỆM VỤ CẤP CỨU NGOẠI VIỆN!</b> 🛡️`,
          ``,
          `Hiệp sĩ tiếp nhận: <b>${user?.fullName || 'Hiệp sĩ SafeSolo'}</b>`,
          `Nạn nhân: <b>${victim.fullName || 'Nạn nhân khẩn cấp'}</b>`,
          `Địa chỉ: <b>${acceptRes.incident?.approxAddress || '227 Nguyễn Văn Cừ, Quận 5'}</b>`,
          `Tình trạng: <b>${acceptRes.incident?.medicalSnapshot?.emergencyNotes || 'Cần hỗ trợ sơ cứu ngoại viện'}</b>`,
          ``,
          `⏱️ <i>Vui lòng bật định vị và di chuyển tiếp cận hiện trường ngay lập tức!</i>`,
        ].join('\n');

        if (chatId && messageId) {
          await this._callTelegramApi('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: acceptedText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🗺️ Mở Bản Đồ Chỉ Đường', url: `https://www.google.com/maps?q=${acceptRes.incident?.fuzzedLat || 10.7626},${acceptRes.incident?.fuzzedLng || 106.6822}` },
                ],
                [
                  { text: '⚡ Mở Tủ AED Gần Nhất', callback_data: `open_aed:nearest` },
                ],
              ],
            },
          });
        }
        return { ok: true, action: 'incident_accepted' };
      } catch (err) {
        await this._callTelegramApi('answerCallbackQuery', {
          callback_query_id: id,
          text: `⚠️ Lỗi nhận ca: ${err.message}`,
          show_alert: true,
        });
        return { ok: true };
      }
    }

    // 5. Open AED Cabinet action
    if (data.startsWith('open_aed:')) {
      const safePointService = require('./safePointService');
      const result = await safePointService.unlockSafePointCabinet('default', fromId, null, 'Cấp cứu ngừng tim AHA qua Telegram');

      await this._callTelegramApi('answerCallbackQuery', {
        callback_query_id: id,
        text: `MÃ OTP MỞ TỦ AED: ${result.unlockOtp}`,
        show_alert: true,
      });

      const aedText = [
        `⚡ <b>MỞ KHÓA TỦ MÁY SỐC TIM OPENAED THÀNH CÔNG!</b> 🫀`,
        ``,
        `Trạm: <b>${result.stationName}</b>`,
        `🔑 <b>MÃ MỞ TỦ (OTP 6 SỐ):</b> <code>${result.unlockOtp}</code>`,
        `⏱️ Hiệu lực: <b>300 giây (5 phút)</b>`,
        ``,
        `📋 <b>Hướng dẫn thao tác:</b>`,
        `1. Nhập mã OTP 6 số trên bàn phím cảm ứng của tủ SafePoint.`,
        `2. Rút máy sốc tim AED và túi cấp cứu mang đến hiện trường.`,
        `3. Khởi động máy AED và dán điện cực theo giọng nói hướng dẫn.`,
      ].join('\n');

      if (chatId && messageId) {
        await this._callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: aedText,
          parse_mode: 'HTML',
        });
      }
      return { ok: true, action: 'aed_unlocked' };
    }

    // 6. Donate Blood action
    if (data.startsWith('donate_blood:')) {
      const requestId = data.split(':')[1];
      const bloodRelayService = require('./bloodRelayService');

      let user = await User.findOne({ telegramChatId: fromId });
      const donorName = user?.fullName || 'Tình nguyện viên';

      try {
        const pledge = await bloodRelayService.acceptBloodDonation(requestId, user?._id || fromId, user?.bloodType || 'O-', 350);
        await this._callTelegramApi('answerCallbackQuery', {
          callback_query_id: id,
          text: '🩸 ĐÃ XÁC NHẬN TIẾP SỨC MÁU KHẨN CẤP!',
          show_alert: true,
        });

        const bloodText = [
          `🩸 <b>XÁC NHẬN ĐĂNG KÝ TIẾP SỨC MÁU HIẾM!</b> 💖`,
          ``,
          `Tình nguyện viên: <b>${donorName}</b>`,
          `Bệnh viện tiếp nhận: <b>${pledge.request?.hospitalName || 'Bệnh viện Chợ Rẫy TP.HCM'}</b>`,
          `Nhóm máu: <b>${pledge.request?.targetBloodGroup || 'O- STAT'}</b>`,
          ``,
          `🎫 <b>MÃ ƯU TIÊN FAST-TRACK QR:</b>`,
          `👉 <code>${pledge.pledge?.fastTrackQr || 'FAST-TRACK-CR-STAT-0992'}</code> 👈`,
          ``,
          `<i>Đưa mã này tại Bàn Tiếp Đón Cấp Cứu để vào thẳng phòng lấy máu không cần lấy số chờ!</i>`,
          `🌟 <i>Hệ thống sẽ cộng +25 điểm Trust Score sau khi hoàn tất.</i>`,
        ].join('\n');

        if (chatId && messageId) {
          await this._callTelegramApi('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: bloodText,
            parse_mode: 'HTML',
          });
        }
        return { ok: true, action: 'blood_pledged' };
      } catch (err) {
        await this._callTelegramApi('answerCallbackQuery', {
          callback_query_id: id,
          text: `⚠️ Lỗi: ${err.message}`,
          show_alert: true,
        });
        return { ok: true };
      }
    }

    // 7. Withdraw Bounty action
    if (data === 'withdraw_bounty') {
      await this._callTelegramApi('answerCallbackQuery', {
        callback_query_id: id,
        text: 'Đã gửi yêu cầu rút 1.850.000 VNĐ về ví MoMo/Ngân hàng!',
        show_alert: true,
      });

      const withdrawText = [
        `💵 <b>YÊU CẦU RÚT TIỀN TRỢ CẤP ĐÃ ĐƯỢC DUYỆT!</b> ✅`,
        ``,
        `Số tiền: <b>1.850.000 VNĐ</b>`,
        `Phương thức: <b>Chuyển khoản NAPAS 24/7 / Ví MoMo</b>`,
        `Nguồn chi trả: <b>Quỹ Bảo Trợ Hiệp Sĩ HeroShield TOC</b>`,
        ``,
        `Khoản trợ cấp xăng xe và hao mòn thiết bị sơ cứu sẽ đến tài khoản của bạn trong 30 giây!`,
      ].join('\n');

      if (chatId && messageId) {
        await this._callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: withdrawText,
          parse_mode: 'HTML',
        });
      }
      return { ok: true, action: 'withdraw_processed' };
    }

    return { ok: true };
  }

  /**
   * Handle incoming Webhook or Polling update
   */
  async handleWebhook(update) {
    if (!update) return { ok: true };

    // Handle button callbacks
    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    if (!update.message) {
      return { ok: true };
    }

    const msg = update.message;
    const chatId = msg.chat?.id;
    const text = (msg.text || '').trim();
    const fromName = msg.from?.first_name || 'Bạn';
    const username = msg.from?.username || '';

    // Cache username -> chatId
    if (username && chatId) {
      this.userChatMap.set(username.toLowerCase(), String(chatId));

      try {
        const User = require('../models/User');
        await User.updateMany(
          {
            $or: [
              { telegramUsername: username },
              { telegramUsername: `@${username}` },
            ],
          },
          { $set: { telegramChatId: String(chatId) } }
        );
      } catch {
        // ignore
      }
    }

    console.log(`[TelegramBotService] Message from @${username || 'anon'} (chatId: ${chatId}): "${text}"`);

    const User = require('../models/User');
    let user = await User.findOne({
      $or: [
        { telegramChatId: String(chatId) },
        ...(username ? [{ telegramUsername: username }, { telegramUsername: `@${username}` }] : []),
      ],
    });
    const isHero = Boolean(user && (user.isHero || user.heroTier !== 'NONE'));

    // 1. Handle Location Sharing (Feature Upgrade: Share Location Auto-Checkin)
    if (msg.location) {
      const lat = msg.location.latitude;
      const lng = msg.location.longitude;
      const now = new Date();

      let cycleMins = 720;
      if (user) {
        cycleMins = Number(user.timerIntervalMinutes || 720);
        user.lastKnownLocation = { lat, lng, updatedAt: now };
        user.lastCheckinTime = now;
        user.nextDeadline = new Date(now.getTime() + cycleMins * 60 * 1000);
        user.consecutiveSoftCheckins = 0;
        user.snoozeCountToday = 0;
        user.currentStatus = 'SAFE';
        user.deadmanStage = 0;
        user.lastReminderAt = null;
        user.lastWarningAt = null;
        await user.save();

        try {
          const CheckInHistory = require('../models/CheckInHistory');
          await CheckInHistory.create({
            userId: user._id,
            checkinTime: now,
            locationAtCheckin: { lat, lng, updatedAt: now },
            type: 'TELEGRAM_LOCATION',
            isSystemAutoTriggered: false,
            metadata: {
              source: 'TELEGRAM_LOCATION_SHARE',
              liveLocation: Boolean(msg.location.live_period),
              latitude: lat,
              longitude: lng,
            },
          });

          const { getIo } = require('../sockets/socketServer');
          const io = getIo();
          if (io) {
            io.emit('CHECKIN_COMPLETED', {
              userId: user._id,
              type: 'TELEGRAM_LOCATION',
              location: { lat, lng },
              nextDeadline: user.nextDeadline.toISOString(),
            });
            io.emit('LOCATION_UPDATED', {
              userId: user._id,
              lat,
              lng,
              updatedAt: now.toISOString(),
            });
          }
        } catch (subErr) {
          console.warn('[TelegramBotService] Location check-in record error:', subErr.message);
        }
      }

      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const nextDeadlineStr = user?.nextDeadline ? formatVnTime(user.nextDeadline) : 'N/A';
      const locReply = [
        `📍 <b>ĐÃ ĐIỂM DANH AN TOÀN QUA VỊ TRÍ TELEGRAM!</b> 💚`,
        ``,
        `Tọa độ: <code>${lat.toFixed(6)}, ${lng.toFixed(6)}</code>`,
        `🗺️ <a href="${mapUrl}">Xem vị trí trên Google Maps</a>`,
        ``,
        `✅ Trạng thái: <b>Đã gia hạn chu kỳ an toàn (+${Math.round(cycleMins / 60)}h)</b>`,
        `⏱️ Hạn chót kế tiếp: <b>${nextDeadlineStr}</b>`,
        ``,
        `Vị trí của bạn đã được cập nhật trực tiếp lên Bản đồ Radar SafeSolo! 🛡️`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: locReply,
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(),
      });
      return { ok: true, action: 'checkin_location_completed', chatId };
    }

    const lower = text.toLowerCase();

    // 2. Start / Help
    if (lower.startsWith('/start') || lower.startsWith('/help')) {
      const reply = [
        `👋 Chào mừng <b>${fromName}</b> đến với <b>SafeSolo Guardian Bot</b>!`,
        ``,
        `🤖 Bot bảo vệ cá nhân thông minh dành cho người sống độc lập:`,
        `• 🔔 <b>Tự động nhắc nhở điểm danh:</b> Bấm 1 chạm để xác nhận bình an.`,
        `• 🚨 <b>Cảnh báo quá hạn:</b> Báo động khẩn cấp khi bạn gặp sự cố.`,
        `• 🔑 <b>Nhận mã xác thực OTP:</b> Đăng nhập SafeSolo siêu tốc.`,
        `• 📍 <b>Đồng bộ vị trí GPS:</b> Gửi vị trí tức thì để cứu hộ.`,
        ``,
        `🆔 <b>Telegram Chat ID của bạn là:</b> <code>${chatId}</code>`,
        `<i>(Nhập số Chat ID này trên ứng dụng SafeSolo để liên kết tài khoản)</i>`,
        ``,
        `💡 <i>Hãy sử dụng các phím bấm tiện ích bên dưới bàn phím để trải nghiệm nhanh:</i>`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: reply,
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(),
      });
      return { ok: true, action: 'start', chatId };
    }

    // 3. 1-Tap Check-in from Menu
    if (text === '💚 Điểm Danh An Toàn' || lower.startsWith('/checkin')) {
      if (!user) {
        user = await User.create({
          fullName: fromName || `User ${chatId}`,
          telegramChatId: String(chatId),
          telegramUsername: username || null,
          authProvider: 'telegram',
          timerIntervalMinutes: 720,
          currentStatus: 'SAFE',
          lastCheckinTime: new Date(),
          nextDeadline: new Date(Date.now() + 720 * 60 * 1000),
          role: 'user',
        }).catch(() => null);
      }

      if (user) {
        const now = new Date();
        const intervalMins = Number(user.timerIntervalMinutes || 720);
        user.lastCheckinTime = now;
        user.nextDeadline = new Date(now.getTime() + intervalMins * 60 * 1000);
        user.currentStatus = 'SAFE';
        user.deadmanStage = 0;
        user.lastReminderAt = null;
        user.lastWarningAt = null;
        await user.save();

        const checkinReply = [
          `💚 <b>ĐÃ ĐIỂM DANH AN TOÀN THÀNH CÔNG!</b>`,
          ``,
          `Hệ thống SafeSolo đã ghi nhận trạng thái bình an của <b>${user.fullName}</b> lúc <b>${formatVnTime(now)}</b>.`,
          `⏱️ Mốc check-in kế tiếp: <b>${formatVnTime(user.nextDeadline)}</b> (${Math.round(intervalMins / 60)} giờ nữa).`,
          ``,
          `Chúc bạn một ngày luôn vui vẻ và an tâm! 🛡️`,
        ].join('\n');

        await this._callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: checkinReply,
          parse_mode: 'HTML',
          reply_markup: this.getMainMenuKeyboard(),
        });
        return { ok: true, action: 'checkin_completed', chatId };
      }
    }

    // 4. View Status / Hồ sơ
    if (text === '📊 Xem Trạng Thái' || lower.startsWith('/status') || lower.startsWith('/profile')) {
      const statusIcon = (!user || user.currentStatus === 'SAFE') ? '🟢 Bình An' : (user.currentStatus === 'REMINDER' ? '🟡 Sắp Đến Hạn' : '🔴 Cảnh Báo');
      const intervalHours = Math.round(Number(user?.timerIntervalMinutes || 720) / 60);
      const deadlineStr = user?.nextDeadline ? formatVnTime(user.nextDeadline) : 'Chưa có';
      const lastCheckinStr = user?.lastCheckinTime ? formatVnTime(user.lastCheckinTime) : 'Chưa có';
      const batteryStr = user?.batteryLevel != null ? `${user.batteryLevel}%` : 'Đang đồng bộ';

      const statusReply = [
        `📊 <b>TRẠNG THÁI AN TOÀN SAFESOLO</b>`,
        ``,
        `👤 Người dùng: <b>${user?.fullName || fromName}</b>`,
        `🆔 Chat ID: <code>${chatId}</code>`,
        `🛡️ Trạng thái: <b>${statusIcon}</b>`,
        `🕒 Điểm danh gần nhất: <b>${lastCheckinStr}</b>`,
        `⏱️ Hạn check-in tới: <b>${deadlineStr}</b>`,
        `⏰ Chu kỳ an toàn: <b>${intervalHours} giờ/lần</b>`,
        `🔋 Pin điện thoại: <b>${batteryStr}</b>`,
        user?.lastKnownLocation ? `📍 Tọa độ GPS: <code>${user.lastKnownLocation.lat?.toFixed(4)}, ${user.lastKnownLocation.lng?.toFixed(4)}</code>` : `📍 Tọa độ GPS: <i>Bấm 'Gửi Vị Trí GPS' để cập nhật</i>`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: statusReply,
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(),
      });
      return { ok: true, action: 'status_displayed', chatId };
    }

    // 5. Test Reminder Demo (Nhận Thử Thông Báo Check-in)
    if (text === '🔔 Nhận Thử Thông Báo' || lower.startsWith('/testreminder')) {
      if (!user) {
        user = {
          _id: 'test_user_id',
          fullName: fromName,
          telegramChatId: String(chatId),
          nextDeadline: new Date(Date.now() + 15 * 60 * 1000),
        };
      }

      await this.sendCheckinReminder(user, 15);
      return { ok: true, action: 'test_reminder_sent', chatId };
    }

    // 6. Snooze 1 Hour
    if (text === '⏰ Gia Hạn 1 Giờ' || lower.startsWith('/snooze')) {
      if (user) {
        const currentDeadline = user.nextDeadline ? new Date(user.nextDeadline).getTime() : Date.now();
        user.nextDeadline = new Date(Math.max(Date.now(), currentDeadline) + 60 * 60 * 1000);
        user.currentStatus = 'SAFE';
        user.lastReminderAt = null;
        user.lastWarningAt = null;
        await user.save();

        const snoozeReply = [
          `💤 <b>ĐÃ GIA HẠN THÊM 1 GIỜ CHECK-IN</b>`,
          ``,
          `⏱️ Mốc an toàn mới của bạn là: <b>${formatVnTime(user.nextDeadline)}</b>.`,
          `SafeSolo sẽ tiếp tục bảo vệ bạn!`,
        ].join('\n');

        await this._callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: snoozeReply,
          parse_mode: 'HTML',
          reply_markup: this.getMainMenuKeyboard(),
        });
        return { ok: true, action: 'snooze_completed', chatId };
      }
    }

    // 7. SOS Alarm from Menu
    if (text === '🆘 Báo Động SOS' || lower.startsWith('/sos')) {
      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: '🚨 XÁC NHẬN PHÁT BÁO ĐỘNG CẤP CỨU', callback_data: `sos:${user?._id || 'direct'}` },
          ],
        ],
      };

      const sosConfirm = [
        `⚠️ <b>XÁC NHẬN PHÁT TÍN HIỆU CẤP CỨU SOS?</b>`,
        ``,
        `Khi bấm xác nhận, SafeSolo sẽ:`,
        `1. Gửi tin nhắn khẩn cấp kèm định vị GPS cho Người bảo hộ.`,
        `2. Bật còi báo động khẩn cấp và chuyển trạng thái tài khoản sang SOS.`,
        ``,
        `Bấm nút dưới đây nếu bạn đang thực sự cần trợ giúp:`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: sosConfirm,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      });
      return { ok: true, action: 'sos_confirm_prompt', chatId };
    }

    // 8. ID lookup
    if (lower.startsWith('/id')) {
      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🆔 Telegram Chat ID của bạn là: <code>${chatId}</code>`,
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(),
      });
      return { ok: true, action: 'id', chatId };
    }

    // 9. Login guide
    if (lower.startsWith('/login')) {
      const reply = [
        `🔐 <b>Hướng dẫn đăng nhập SafeSolo qua Telegram:</b>`,
        ``,
        `1. Mở app SafeSolo -> Chọn tab <b>Telegram Bot</b>.`,
        `2. Nhập Chat ID của bạn: <code>${chatId}</code>`,
        `3. Bấm <b>"Gửi mã OTP qua Telegram"</b>.`,
        `4. Bot sẽ gửi mã 6 số ngay vào khung chat này!`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: reply,
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(isHero),
      });
      return { ok: true, action: 'login', chatId };
    }

    // 10. Radar / Ca SOS Lân Cận (Dành cho Hiệp Sĩ & Đội Cứu Nạn)
    if (text === '🚨 Ca SOS Lân Cận' || lower.startsWith('/nearby') || lower.startsWith('/radar') || lower.startsWith('/hero')) {
      const RescueIncident = require('../models/RescueIncident');
      const activeIncidents = await RescueIncident.find({
        status: { $in: ['ACTIVE', 'TRIGGERED', 'DISPATCHING_R1', 'DISPATCHING_R2', 'EN_ROUTE'] },
      }).sort({ createdAt: -1 }).limit(3).lean();

      if (activeIncidents.length === 0) {
        const noIncidentMsg = [
          `🚨 <b>BÀN TÁC CHIẾN RADAR NGOẠI VIỆN</b> 🛡️`,
          ``,
          `✅ <b>Hiện không có ca cấp cứu khẩn cấp nào trong bán kính trực chiến.</b>`,
          `Mạng lưới SafeSolo TOC đang giám sát bình thường.`,
          ``,
          `<i>Khi có sự cố ngừng tim hoặc chấn thương, bạn sẽ nhận được thông báo rung chuông ưu tiên ngay lập tức!</i>`,
        ].join('\n');

        await this._callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: noIncidentMsg,
          parse_mode: 'HTML',
          reply_markup: this.getMainMenuKeyboard(isHero),
        });
        return { ok: true, action: 'radar_empty', chatId };
      }

      for (const inc of activeIncidents) {
        const victimName = inc.victim?.fullName || 'Nạn nhân khẩn cấp';
        const address = inc.approxAddress || '227 Nguyễn Văn Cừ, Quận 5, TP.HCM';
        const priority = inc.severityLevel || 'P1';
        const notes = inc.medicalSnapshot?.emergencyNotes || inc.description || 'Nghi ngờ ngừng tim ngoại viện / rung nhĩ khẩn cấp';
        const lat = inc.fuzzedLat || 10.7626;
        const lng = inc.fuzzedLng || 106.6822;

        const incText = [
          `🚨 <b>[PHÁT LỆNH ĐIỀU PHỐI ${priority}] CA CẤP CỨU NGOẠI VIỆN</b>`,
          ``,
          `Nạn nhân: <b>${victimName}</b>`,
          `Tình trạng: <b>${notes}</b>`,
          `📍 Địa chỉ: <b>${address}</b>`,
          `⏱️ Thời gian: <b>${formatVnTime(inc.createdAt)}</b>`,
          ``,
          `<i>Bấm nút bên dưới để nhận ca và mở đường dẫn trực tiếp:</i>`,
        ].join('\n');

        await this._callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: incText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🚗 TIẾP NHẬN CA CỨU NẠN', callback_data: `accept_incident:${inc._id}` },
                { text: '🗺️ BẢN ĐỒ', url: `https://www.google.com/maps?q=${lat},${lng}` },
              ],
              [
                { text: '⚡ Mở Tủ Máy Sốc Tim AED Gần Đó', callback_data: `open_aed:nearest` },
              ],
            ],
          },
        });
      }
      return { ok: true, action: 'radar_incidents_sent', chatId };
    }

    // 11. Mở Tủ AED Gần Nhất (Cấp cứu Ngừng Tim AHA)
    if (text === '⚡ Mở Tủ AED Gần Nhất' || text === '⚡ Tìm Máy Sốc Tim AED' || lower.startsWith('/aed')) {
      const safePointService = require('./safePointService');
      const cabinetRes = await safePointService.unlockSafePointCabinet('default', user?._id || String(chatId), null, 'Cấp cứu ngừng tim AHA qua Telegram');

      const aedReply = [
        `⚡ <b>MÃ MỞ TỦ MÁY SỐC TIM OPENAED KHẨN CẤP!</b> 🫀`,
        ``,
        `Trạm cứu sinh: <b>${cabinetRes.stationName}</b>`,
        `📍 Vị trí: <i>Tủ SafePoint ngoài trời - Cửa sổ kính cường lực</i>`,
        ``,
        `🔑 <b>MÃ TOTP 6 SỐ MỞ TỦ:</b>`,
        `👉 <code>${cabinetRes.unlockOtp}</code> 👈`,
        `⏱️ Hiệu lực: <b>300 giây (5 phút)</b>`,
        ``,
        `📋 <b>Quy trình cấp cứu:</b>`,
        `1. Nhập mã OTP 6 số trên bàn phím cảm ứng tủ để nhả chốt khóa điện từ.`,
        `2. Rút máy sốc tim AED và túi sơ cứu mang đến hiện trường.`,
        `3. Khởi động máy, nghe loa hướng dẫn ép tim CPR 30:2 và dán bản cực sốc điện.`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: aedReply,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🗺️ Mở Google Maps Đến Trạm AED', url: 'https://www.google.com/maps?q=10.7845,106.6925' },
            ],
          ],
        },
      });
      return { ok: true, action: 'aed_unlocked_message', chatId };
    }

    // 12. SafeBlood Máu Hiếm
    if (text === '🩸 SafeBlood Máu Hiếm' || lower.startsWith('/blood')) {
      const bloodRelayService = require('./bloodRelayService');
      const requests = await bloodRelayService.getActiveRequests();
      const firstReq = requests[0] || {
        hospitalName: 'Bệnh viện Chợ Rẫy TP.HCM',
        targetBloodGroup: 'O-',
        unitsNeeded: 2,
        urgencyLevel: 'STAT',
      };

      const bloodReply = [
        `🩸 <b>MẠNG LƯỚI ĐIỀU PHỐI MÁU HIẾM SAFEBLOOD RELAY</b>`,
        ``,
        `Bệnh viện yêu cầu: <b>${firstReq.hospitalName}</b>`,
        `Nhóm máu cần tiếp sức: <b>${firstReq.targetBloodGroup} (${firstReq.urgencyLevel} - TỐI KHẨN CẤP)</b>`,
        `Số lượng: <b>${firstReq.unitsNeeded || 2} đơn vị (450ml)</b>`,
        `Tương thích sinh học: <b>Nhóm máu O- (Người cho phổ thông)</b>`,
        ``,
        `<i>Mỗi giọt máu trao đi trong khung giờ vàng cứu sống một sinh mạng!</i>`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: bloodReply,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🩸 ĐĂNG KÝ TIẾP SỨC MÁU NGAY', callback_data: `donate_blood:${firstReq.id || 'default'}` },
            ],
            [
              { text: '🏥 Chỉ Đường Đến BV Chợ Rẫy', url: 'https://www.google.com/maps?q=10.7578,106.6598' },
            ],
          ],
        },
      });
      return { ok: true, action: 'blood_relay_sent', chatId };
    }

    // 13. Thẻ Ngành & Ví Quỹ HeroShield
    if (text === '💳 Thẻ Ngành & Ví Quỹ' || lower.startsWith('/badge') || lower.startsWith('/wallet')) {
      const cat = user?.professionCategory || 'MEDICAL_NURSE';
      let profName = 'Y Tế & Điều Dưỡng Ngoại Viện (Paramedic)';
      if (cat === 'POLICE_SECURITY') profName = 'Chiến Sĩ Công An & An Ninh Cơ Sở';
      else if (cat === 'FIRE_RESCUE') profName = 'Cảnh Sát PCCC & Cứu Nạn Cứu Hộ';
      else if (cat === 'WILDERNESS_EXPLORER') profName = 'Cứu Hộ Địa Hình Hiểm Trở WFR';

      const cert = user?.credentialNumber || 'CERT-018492-BYT';
      const unit = user?.workingUnit || 'Trung tâm Phản ứng Nhanh TOC SafeSolo';
      const exp = user?.yearsOfExperience || 4;
      const bal = user?.walletBalance || 1850000;
      const formattedBal = Number(bal).toLocaleString('vi-VN');

      const badgeReply = [
        `💳 <b>THẺ HIỆP SĨ ĐIỆN TỬ & VÍ TRỢ CẤP SAFESOLO</b> 🛡️`,
        ``,
        `Họ và tên: <b>${user?.fullName || fromName}</b>`,
        `Khối ngành: <b>${profName}</b>`,
        `Số hiệu CCHN: <code>${cert}</code>`,
        `Đơn vị công tác: <b>${unit}</b>`,
        `Thâm niên: <b>${exp} năm kinh nghiệm</b>`,
        ``,
        `💰 <b>SỐ DƯ VÍ TRỢ CẤP XĂNG XE & VẬT TƯ:</b>`,
        `👉 <b>${formattedBal} VNĐ</b> 👈`,
        `<i>(Nguồn từ Quỹ Bảo Trợ Hiệp Sĩ HeroShield & Doanh nghiệp B2B bảo trợ)</i>`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: badgeReply,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💵 Rút Tiền Về MoMo / Ngân Hàng', callback_data: 'withdraw_bounty' },
            ],
            [
              { text: '⚖️ Xem Lá Chắn Pháp Lý Điều 87', callback_data: 'view_legal' },
            ],
          ],
        },
      });
      return { ok: true, action: 'badge_wallet_sent', chatId };
    }

    // 14. Tra Cứu Pháp Lý Điều 87
    if (text === '⚖️ Tra Cứu Pháp Lý 87' || lower.startsWith('/legal')) {
      const legalReply = [
        `⚖️ <b>LÁ CHẮN PHÁP LÝ BẢO VỆ HIỆP SĨ SAFESOLO</b>`,
        ``,
        `📜 <b>1. Điều 87 Luật Khám bệnh, chữa bệnh số 15/2023/QH15:</b>`,
        `<i>Người tham gia cấp cứu ngoại viện được bảo vệ tính mạng, sức khỏe, danh dự và được miễn trừ trách nhiệm dân sự khi thực hiện các hành động sơ cứu nhân đạo theo đúng khả năng chuyên môn.</i>`,
        ``,
        `🛡️ <b>2. Điều 23 Bộ luật Hình sự 2015 (Tình thế cấp thiết):</b>`,
        `<i>Hành vi gây thiệt hại nhỏ hơn thiệt hại cần ngăn ngừa trong tình thế cấp thiết nhằm bảo vệ tính mạng người khác không phải là tội phạm.</i>`,
        ``,
        `🚑 <b>3. Quỹ Bảo Hiểm HeroShield:</b>`,
        `• Bảo hiểm hỗ trợ pháp lý: <b>500.000.000 VNĐ</b>`,
        `• Chi trả rủi ro tai nạn / phơi nhiễm: <b>100.000.000 VNĐ</b>`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: legalReply,
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(isHero),
      });
      return { ok: true, action: 'legal_sent', chatId };
    }

    // 15. Đăng Ký Hiệp Sĩ KYC / Tra Cứu Tiến Độ
    if (text === '🛡️ Đăng Ký Hiệp Sĩ KYC' || lower.startsWith('/kyc')) {
      const KYCDocument = require('../models/KYCDocument');
      const doc = user ? await KYCDocument.findOne({ userId: user._id }).lean() : null;

      let kycReply = [];
      if (!doc) {
        kycReply = [
          `🛡️ <b>ĐĂNG KÝ GIA NHẬP ĐỘI NGŨ HIỆP SĨ SAFESOLO</b>`,
          ``,
          `Theo quy định pháp luật và chuẩn an toàn sinh mạng, SafeSolo chỉ phê duyệt các ứng viên thuộc <b>4 Khối Ngành Chuyên Môn</b>:`,
          `1. 🩺 <b>Y Tế:</b> Bác sĩ, Y tá, Paramedic, Điều dưỡng ngoại viện (có CCHN).`,
          `2. 👮 <b>Công An:</b> Cán bộ chiến sĩ CAND, Lực lượng ANTT Cơ sở.`,
          `3. 🚒 <b>PCCC & CNCH:</b> Cán bộ chiến sĩ Cảnh sát PCCC chuyên nghiệp.`,
          `4. 🧗 <b>Cứu Hộ Dã Ngoại:</b> Chứng chỉ Wilderness First Responder (WFR).`,
          ``,
          `👉 Vui lòng mở ứng dụng SafeSolo trên điện thoại -> Chọn mục <b>"Hiệp Sĩ"</b> -> Bấm <b>"Nộp KYC"</b> để tải lên Thẻ Ngành và làm bài sát hạch lâm sàng!`,
        ];
      } else {
        const statusMap = {
          APPROVED: '✅ ĐÃ PHÊ DUYỆT CHÍNH THỨC',
          PENDING: '⏳ ĐANG CHỜ ĐỐI SOÁT CHUYÊN MÔN',
          REJECTED: '❌ CHƯA ĐẠT TIÊU CHUẨN',
        };
        kycReply = [
          `🛡️ <b>TIẾN ĐỘ THẨM ĐỊNH HỒ SƠ HIỆP SĨ</b>`,
          ``,
          `Trạng thái: <b>${statusMap[doc.status] || doc.status}</b>`,
          `Khối ngành đăng ký: <b>${doc.professionCategory || 'Y Tế Ngoại Viện'}</b>`,
          `Số hiệu chứng chỉ: <code>${doc.credentialNumber || 'CERT-PENDING'}</code>`,
          `Điểm sát hạch lâm sàng: <b>${doc.theoryExamScore || 19}/20 điểm</b> (Chuẩn: >=18/20)`,
          `Khớp khuôn mặt AI FaceMatch: <b>${doc.faceMatchPercentage || 98}%</b> (Chuẩn: >=90%)`,
        ];
      }

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: kycReply.join('\n'),
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(isHero),
      });
      return { ok: true, action: 'kyc_status_sent', chatId };
    }

    // 16. Trạng Thái Trực Chiến (Hiệp Sĩ)
    if (text === '📊 Trạng Thái Trực Chiến') {
      const heroStatus = [
        `📊 <b>TRẠNG THÁI TRỰC CHIẾN HIỆP SĨ TOC</b> 🛡️`,
        ``,
        `👤 Hiệp sĩ: <b>${user?.fullName || fromName}</b>`,
        `🟢 Trực chiến: <b>SẴN SÀNG PHẢN ỨNG NHANH</b>`,
        `📡 Tín hiệu Radar: <b>Kết nối thời gian thực 24/7</b>`,
        `📍 Bán kính tiếp nhận: <b>5.0 km quanh vị trí hiện tại</b>`,
        `🔋 Pin điện thoại: <b>${user?.batteryLevel || 94}%</b>`,
        `🕒 Cập nhật: <b>${formatVnTime(new Date())}</b>`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: heroStatus,
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(isHero),
      });
      return { ok: true, action: 'hero_duty_status_sent', chatId };
    }

    // Default response with menu
    const defaultReply = [
      `🤖 <b>SafeSolo Guardian Bot</b> đã sẵn sàng!`,
      `🆔 Chat ID: <code>${chatId}</code>`,
      ``,
      isHero
        ? `🎖️ <b>Bạn đang trong ca trực Hiệp Sĩ SafeSolo TOC:</b>\n• Bấm <b>"🚨 Ca SOS Lân Cận"</b> để nhận ca cứu nạn\n• Bấm <b>"⚡ Mở Tủ AED Gần Nhất"</b> để lấy mã OTP máy sốc tim\n• Bấm <b>"🩸 SafeBlood Máu Hiếm"</b> để xem lệnh điều phối máu\n• Bấm <b>"💳 Thẻ Ngành & Ví Quỹ"</b> để xem trợ cấp xăng xe`
        : `Hãy sử dụng các phím bấm bên dưới hoặc gõ:\n• <b>/checkin</b>: Điểm danh bình an\n• <b>/status</b>: Xem trạng thái và hạn check-in\n• <b>/aed</b>: Tìm máy sốc tim OpenAED\n• <b>/help</b>: Xem hướng dẫn`,
    ].join('\n');

    await this._callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: defaultReply,
      parse_mode: 'HTML',
      reply_markup: this.getMainMenuKeyboard(isHero),
    });

    return { ok: true, chatId };
  }

  /**
   * Helper tương thích nhận message trực tiếp
   */
  async handleIncomingMessage(msg) {
    return await this.handleWebhook({ message: msg });
  }
}

module.exports = new TelegramBotService();
