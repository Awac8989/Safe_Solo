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
   * Persistent Reply Keyboard Menu
   */
  getMainMenuKeyboard() {
    return {
      keyboard: [
        [{ text: '💚 Điểm Danh An Toàn' }, { text: '📊 Xem Trạng Thái' }],
        [{ text: '🔔 Nhận Thử Thông Báo' }, { text: '📍 Gửi Vị Trí GPS', request_location: true }],
        [{ text: '⏰ Gia Hạn 1 Giờ' }, { text: '🆘 Báo Động SOS' }],
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
   * Send Check-in Reminder with 1-Tap Inline Buttons
   */
  async sendCheckinReminder(user, minutesUntilDeadline) {
    this.reloadConfig();
    const chatId = await this.resolveChatId(user.telegramChatId || user.telegramUsername);
    if (!chatId || !/^-?\d+$/.test(chatId)) {
      return { success: false, error: 'No numerical chatId' };
    }

    const deadlineStr = formatVnTime(user.nextDeadline);
    const text = [
      `⏰ <b>[SAFESOLO] NHẮC NHỞ ĐIỂM DANH BÌNH AN</b>`,
      ``,
      `Xin chào <b>${user.fullName || 'bạn'}</b>,`,
      `Bạn sắp đến hạn check-in định kỳ:`,
      `⏱️ Còn khoảng <b>${Math.max(1, Math.round(minutesUntilDeadline))} phút</b> (Hạn chót: <b>${deadlineStr}</b>).`,
      ``,
      `Vui lòng bấm nút bên dưới để xác nhận bạn vẫn an toàn:`,
    ].join('\n');

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

    // 1. Handle Location Sharing
    if (msg.location) {
      const lat = msg.location.latitude;
      const lng = msg.location.longitude;

      if (user) {
        user.lastKnownLocation = { lat, lng, updatedAt: new Date() };
        await user.save();
      }

      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const locReply = [
        `📍 <b>ĐÃ CẬP NHẬT TỌA ĐỘ VỊ TRÍ GPS!</b>`,
        ``,
        `Tọa độ: <code>${lat.toFixed(6)}, ${lng.toFixed(6)}</code>`,
        `🗺️ <a href="${mapUrl}">Xem bản đồ Google Maps</a>`,
        ``,
        `SafeSolo sẽ sử dụng tọa độ này khi bạn bấm SOS khẩn cấp hoặc cần cứu hộ.`,
      ].join('\n');

      await this._callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: locReply,
        parse_mode: 'HTML',
        reply_markup: this.getMainMenuKeyboard(),
      });
      return { ok: true, action: 'location_updated', chatId };
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
        reply_markup: this.getMainMenuKeyboard(),
      });
      return { ok: true, action: 'login', chatId };
    }

    // Default response with menu
    const defaultReply = [
      `🤖 <b>SafeSolo Guardian Bot</b> đã sẵn sàng!`,
      `🆔 Chat ID: <code>${chatId}</code>`,
      ``,
      `Hãy sử dụng các phím bấm bên dưới hoặc gõ:`,
      `• <b>/checkin</b>: Điểm danh bình an`,
      `• <b>/status</b>: Xem trạng thái và hạn check-in`,
      `• <b>/testreminder</b>: Thử nhận thông báo check-in với nút bấm`,
      `• <b>/help</b>: Xem hướng dẫn`,
    ].join('\n');

    await this._callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: defaultReply,
      parse_mode: 'HTML',
      reply_markup: this.getMainMenuKeyboard(),
    });

    return { ok: true, chatId };
  }
}

module.exports = new TelegramBotService();
