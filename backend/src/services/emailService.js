const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.reloadConfig();
    this.outbox = []; // Lưu trữ email đã gửi phục vụ debug/kiểm thử
  }

  reloadConfig() {
    this.user = process.env.GMAIL_USER || process.env.SMTP_USER || '';
    this.pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD || '';
    this.from = process.env.EMAIL_FROM || (this.user ? `"SafeSolo Security" <${this.user}>` : '"SafeSolo Security" <no-reply@safesolo.vn>');
    this.isConfigured = Boolean(this.user && this.pass && this.user.includes('@'));

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.user,
          pass: this.pass.replace(/\s+/g, ''), // Xóa khoảng trắng nếu người dùng copy từ Google App Password
        },
      });
    } else {
      this.transporter = null;
    }
  }

  /**
   * Gửi email HTML với fallback sang Outbox nếu chưa cấu hình Gmail App Password
   */
  async sendMail({ to, subject, html, text }) {
    this.reloadConfig();

    const mailOptions = {
      from: this.from,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, ''),
      html,
    };

    // Ghi nhận vào outbox nội bộ
    const outboxItem = {
      to,
      subject,
      timestamp: new Date().toISOString(),
      preview: text || subject,
      html,
    };
    this.outbox.unshift(outboxItem);
    if (this.outbox.length > 50) this.outbox.pop();

    if (this.isConfigured && this.transporter) {
      try {
        console.log(`[EmailService] Đang gửi thư thật qua Gmail SMTP đến: ${to}...`);
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Gửi email thành công qua Gmail: ${info.messageId}`);
        return {
          success: true,
          mode: 'gmail-live',
          messageId: info.messageId,
          recipient: to,
        };
      } catch (error) {
        console.error(`[EmailService] Lỗi khi gửi qua Gmail SMTP: ${error.message}`);
        return {
          success: false,
          mode: 'gmail-error-fallback',
          error: error.message,
          recipient: to,
          outboxItem,
        };
      }
    }

    console.log(`[EmailService] [Sandbox Mode] Đã tạo thư gửi đến ${to}: "${subject}" (Chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD)`);
    return {
      success: true,
      mode: 'sandbox-simulated',
      recipient: to,
      message: 'Email đã được ghi nhận trong hệ thống SafeSolo Outbox.',
      outboxItem,
    };
  }

  /**
   * Template email: Mã OTP Đăng nhập Gmail
   */
  async sendLoginOtpEmail(email, otpCode, recipientName = 'Người dùng SafeSolo') {
    const subject = `[SafeSolo] Mã xác thực đăng nhập: ${otpCode}`;
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Mã xác thực đăng nhập SafeSolo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
    .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .otp-box { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .otp-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #15803d; letter-spacing: 1px; margin-bottom: 8px; }
    .otp-code { font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 36px; font-weight: 800; color: #0f172a; letter-spacing: 8px; }
    .notice { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px; font-size: 13px; color: #b45309; line-height: 1.5; margin-bottom: 24px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ SafeSolo Security</h1>
      <p>Bảo Vệ Sự Sống & An Toàn Cá Nhân Độc Lập</p>
    </div>
    <div class="content">
      <div class="greeting">Xin chào ${recipientName},</div>
      <div class="desc">
        Hệ thống nhận được yêu cầu đăng nhập vào ứng dụng <strong>SafeSolo</strong> bằng tài khoản Gmail này. Vui lòng sử dụng mã xác thực OTP 6 chữ số dưới đây để tiếp tục:
      </div>
      <div class="otp-box">
        <div class="otp-label">MÃ XÁC THỰC ĐĂNG NHẬP (OTP)</div>
        <div class="otp-code">${otpCode}</div>
      </div>
      <div class="notice">
        ⏱️ <strong>Lưu ý:</strong> Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai để bảo vệ thông tin vị trí và hồ sơ y tế khẩn cấp của bạn.
      </div>
      <div class="desc" style="margin-bottom: 0;">
        Nếu bạn không thực hiện yêu cầu này, có thể ai đó đã nhập nhầm địa chỉ email của bạn. Bạn có thể bỏ qua thư này an toàn.
      </div>
    </div>
    <div class="footer">
      © 2026 SafeSolo Inc. Nền tảng điều phối cứu hộ 115 & Giám sát an toàn công nghệ cao.
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to: email,
      subject,
      html,
      text: `[SafeSolo] Mã OTP đăng nhập của bạn là: ${otpCode}. Hiệu lực 10 phút. Tuyệt đối không chia sẻ mã này.`,
    });
  }

  /**
   * Template email: Khôi phục & Đặt lại Mật khẩu
   */
  async sendPasswordResetEmail(email, resetCode, recipientName = 'Người dùng SafeSolo') {
    const subject = `[SafeSolo] Mã khôi phục mật khẩu: ${resetCode}`;
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Khôi phục mật khẩu SafeSolo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
    .desc { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .otp-box { background: #fef2f2; border: 2px dashed #ef4444; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .otp-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #b91c1c; letter-spacing: 1px; margin-bottom: 8px; }
    .otp-code { font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 38px; font-weight: 800; color: #991b1b; letter-spacing: 8px; }
    .notice { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 14px; font-size: 13px; color: #9f1239; line-height: 1.5; margin-bottom: 24px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 SafeSolo Account Recovery</h1>
      <p>Khôi Phục Quyền Truy Cập Tài Khoản An Toàn</p>
    </div>
    <div class="content">
      <div class="greeting">Xin chào ${recipientName},</div>
      <div class="desc">
        Hệ thống nhận được yêu cầu <strong>đặt lại mật khẩu</strong> cho tài khoản SafeSolo gắn với địa chỉ Gmail này.
        Vui lòng nhập mã bảo mật 6 số bên dưới vào ứng dụng:
      </div>
      <div class="otp-box">
        <div class="otp-label">MÃ XÁC THỰC ĐẶT LẠI MẬT KHẨU</div>
        <div class="otp-code">${resetCode}</div>
      </div>
      <div class="notice">
        ⏱️ <strong>Thời hạn sử dụng:</strong> Mã này có hiệu lực trong <strong>15 phút</strong>.<br>
        ⚠️ <strong>Cảnh báo bảo mật:</strong> Nếu bạn KHÔNG thực hiện yêu cầu này, vui lòng mở ứng dụng SafeSolo và kích hoạt tính năng khóa tài khoản khẩn cấp ngay lập tức.
      </div>
    </div>
    <div class="footer">
      © 2026 SafeSolo Inc. Hệ thống cảnh báo & Bảo mật tài khoản cá nhân.
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to: email,
      subject,
      html,
      text: `[SafeSolo] Mã khôi phục mật khẩu của bạn là: ${resetCode}. Hiệu lực 15 phút. Tuyệt đối không chia sẻ mã này.`,
    });
  }

  /**
   * Template email: Cảnh báo Cấp Cứu SOS Khẩn Cấp gửi Người Bảo Hộ & Gia Đình
   */
  async sendSosEmergencyAlertEmail(firstArg = {}, locationArg = {}, contactsArg = []) {
    let to, victimName, victimPhone, lat, lng, approxAddress, heartRate, battery, triggerSource, medicalProfile;

    if (firstArg && (firstArg.fullName || firstArg._id || Array.isArray(contactsArg) || locationArg.lat !== undefined)) {
      // Gọi dạng: sendSosEmergencyAlertEmail(user, location, contacts)
      const user = firstArg;
      victimName = user.fullName || 'Người dùng SafeSolo';
      victimPhone = user.phoneNumber || '';
      lat = locationArg?.lat || 10.762622;
      lng = locationArg?.lng || 106.682276;
      approxAddress = locationArg?.address || user.approxAddress || 'Đang xác định tọa độ GPS';
      triggerSource = 'SOS_BUTTON';
      medicalProfile = {
        bloodType: user.bloodType || 'O+',
        allergies: user.allergies || user.medicalNotes || 'Chưa ghi nhận dị ứng thuốc',
        conditions: user.conditions || 'Khỏe mạnh',
      };

      const contactList = Array.isArray(contactsArg) && contactsArg.length > 0
        ? contactsArg
        : (user.emergencyContacts || []);
      const contactEmails = contactList.map(c => c.email).filter(Boolean);

      if (contactEmails.length > 0) {
        to = contactEmails;
      } else if (user.email) {
        to = user.email;
      } else {
        to = process.env.GMAIL_USER;
      }
    } else {
      // Gọi dạng: sendSosEmergencyAlertEmail({ to, victimName, ... })
      const opts = firstArg;
      to = opts.to || process.env.GMAIL_USER;
      victimName = opts.victimName || 'Người dùng SafeSolo';
      victimPhone = opts.victimPhone || '';
      lat = opts.lat || 10.762622;
      lng = opts.lng || 106.682276;
      approxAddress = opts.approxAddress || 'Đang xác định tọa độ';
      heartRate = opts.heartRate;
      battery = opts.battery;
      triggerSource = opts.triggerSource || 'SOS_BUTTON';
      medicalProfile = opts.medicalProfile;
    }

    const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const subject = `🚨 [KHẨN CẤP] CẢNH BÁO SOS: ${victimName.toUpperCase()} ĐANG CẦN TRỢ GIÚP GẤP!`;
    const triggerText = triggerSource === 'DURESS_PIN' ? 'Mã bí mật Duress PIN (Bị đe dọa/Cưỡng bức)' : triggerSource === 'DEAD_MAN_TIMEOUT' ? 'Hết hạn Dead-Man Timer không phản hồi' : 'Bấm nút SOS Khẩn Cấp';

    const bloodType = medicalProfile?.bloodType || 'O+';
    const allergies = medicalProfile?.allergies || 'Chưa ghi nhận dị ứng thuốc';
    const conditions = medicalProfile?.conditions || 'Chưa ghi nhận bệnh mạn tính';

    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Cảnh Báo SOS Khẩn Cấp SafeSolo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 20px; color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 2px solid #ef4444; overflow: hidden; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3); }
    .header { background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.95; }
    .content { padding: 24px; }
    .alert-box { background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .alert-title { color: #fca5a5; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .alert-victim { color: #ffffff; font-size: 18px; font-weight: 800; }
    .meta-grid { display: table; width: 100%; margin-bottom: 20px; }
    .meta-row { display: table-row; }
    .meta-cell { display: table-cell; padding: 6px 0; font-size: 13px; color: #94a3b8; }
    .meta-val { display: table-cell; padding: 6px 0; font-size: 13px; color: #f8fafc; font-weight: 600; text-align: right; }
    .med-box { background: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #38bdf8; }
    .med-title { color: #38bdf8; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; }
    .btn-action { display: block; background: #dc2626; color: #ffffff; text-align: center; padding: 14px 20px; border-radius: 10px; font-weight: 700; text-decoration: none; margin-bottom: 12px; font-size: 14px; }
    .footer { background: #0b1120; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 CẢNH BÁO KHẨN CẤP SAFESOLO SOS</h1>
      <p>Hệ thống giám sát phát hiện sự cố nguy hiểm đến tính mạng</p>
    </div>
    <div class="content">
      <div class="alert-box">
        <div class="alert-title">NẠN NHÂN CẦN CỨU HỘ:</div>
        <div class="alert-victim">${victimName.toUpperCase()}</div>
        <div style="color: #f87171; font-size: 12.5px; margin-top: 4px;">Nguyên nhân: <strong>${triggerText}</strong></div>
      </div>

      <div class="meta-grid">
        <div class="meta-row">
          <div class="meta-cell">📍 Vị trí ước tính:</div>
          <div class="meta-val">${approxAddress}</div>
        </div>
        <div class="meta-row">
          <div class="meta-cell">🌐 Tọa độ GPS:</div>
          <div class="meta-val">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
        </div>
        <div class="meta-row">
          <div class="meta-cell">⏱️ Thời gian phát lệnh:</div>
          <div class="meta-val">${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>
        </div>
        ${heartRate ? `<div class="meta-row"><div class="meta-cell">❤️ Nhịp tim viễn thám:</div><div class="meta-val" style="color: #ef4444;">${heartRate} BPM</div></div>` : ''}
        ${battery != null ? `<div class="meta-row"><div class="meta-cell">🔋 Mức pin điện thoại:</div><div class="meta-val">${battery}%</div></div>` : ''}
        ${victimPhone ? `<div class="meta-row"><div class="meta-cell">📞 Số điện thoại nạn nhân:</div><div class="meta-val"><a href="tel:${victimPhone}" style="color: #38bdf8;">${victimPhone}</a></div></div>` : ''}
      </div>

      <a href="${mapUrl}" class="btn-action">🗺️ MỞ BẢN ĐỒ GOOGLE MAPS XEM VỊ TRÍ NẠN NHÂN</a>

      <div class="med-box">
        <div class="med-title">📋 HỒ SƠ Y TẾ KHẨN CẤP (SAFETAG GOLD RECORD)</div>
        <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.6;">
          • <strong>Nhóm máu:</strong> <span style="color: #f59e0b; font-weight: bold;">${bloodType}</span><br>
          • <strong>Dị ứng thuốc/thức ăn:</strong> <span style="color: #ef4444;">${allergies}</span><br>
          • <strong>Bệnh nền/Tiền sử:</strong> ${conditions}
        </div>
      </div>

      <div style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
        ⚠️ <strong>Hành động khẩn cấp:</strong> Hãy gọi điện ngay cho nạn nhân hoặc liên hệ Tổng đài 115 / Công an 113 khu vực gần nhất!
      </div>
    </div>
    <div class="footer">
      © 2026 SafeSolo Emergency Response TOC. Thông báo tự động bảo vệ tính mạng.
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to,
      subject,
      html,
      text: `[KHẨN CẤP] Nạn nhân ${victimName} vừa phát tín hiệu SOS! Vị trí: ${approxAddress} (${mapUrl}). Nhóm máu: ${bloodType}. Vui lòng kiểm tra ngay!`,
    });
  }

  /**
   * Template email: Thư Bổ Nhiệm & Cấp Quyền Hiệp Sĩ 4 Khối Ngành
   */
  async sendHeroKycApprovedEmail(user, document) {
    const to = user.email || document.email;
    if (!to) return { success: false, error: 'User has no email' };

    const heroName = user.fullName || document.fullName || 'Hiệp Sĩ SafeSolo';
    const cat = document.professionCategory || 'MEDICAL_NURSE';
    const tier = document.specialtyTier || 'TIER_PARAMEDIC_MEDIC';
    const certNum = document.credentialNumber || 'CERT-APPROVED';
    const unit = document.workingUnit || 'Trung tâm Phản ứng Nhanh TOC SafeSolo';

    let profTitle = 'ĐIỀU DƯỠNG / Y BÁC SĨ CẤP CỨU NGOẠI VIỆN (PARAMEDIC)';
    let profColor = '#10b981';
    let scopeDesc = 'CPR/AED chuẩn AHA, đặt đường thở Mask Ambu, băng ép garô CAT cầm máu động mạch, thuốc cấp cứu theo y lệnh 115.';
    if (cat == 'POLICE_SECURITY') {
      profTitle = 'CHIẾN SĨ CÔNG AN / AN NINH TRẬT TỰ CƠ SỞ';
      profColor = '#38bdf8';
      scopeDesc = 'Bảo vệ hiện trường khẩn cấp, trấn áp đối tượng nguy hiểm theo mã Duress, phân luồng giao thông cứu nạn, phối hợp 113.';
    } else if (cat == 'FIRE_RESCUE') {
      profTitle = 'CHIẾN SĨ CẢNH SÁT PCCC & CỨU NẠN CỨU HỘ';
      profColor = '#ef4444';
      scopeDesc = 'Phá dỡ chướng ngại vật khẩn cấp, cứu nạn không gian kín / đám cháy, sơ tán nạn nhân, phối hợp tổng đài 114.';
    } else if (cat == 'WILDERNESS_EXPLORER') {
      profTitle = 'CỨU HỘ ĐỊA HÌNH HIỂM TRỞ WFR (WILDERNESS RESPONDER)';
      profColor = '#f59e0b';
      scopeDesc = 'Định vị GPS ngoại tuyến, nẹp cố định xương gãy dã chiến, chống hạ thân nhiệt, kỹ thuật võng tải thương địa hình rừng núi.';
    }

    const subject = `🎖️ [SAFESOLO] CHÚC MỪNG BỔ NHIỆM HIỆP SĨ CỨU HỘ: ${heroName.toUpperCase()}`;
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Bổ nhiệm Hiệp Sĩ SafeSolo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 20px; color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 2px solid ${profColor}; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px 24px; text-align: center; border-bottom: 2px solid ${profColor}; }
    .badge { display: inline-block; background: rgba(16, 185, 129, 0.2); border: 1px solid ${profColor}; color: ${profColor}; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; margin-bottom: 12px; }
    .content { padding: 28px 24px; }
    .card-id { background: #1e293b; border-radius: 14px; padding: 20px; border: 1px solid #334155; margin-bottom: 20px; }
    .legal-box { background: rgba(56, 189, 248, 0.1); border-left: 4px solid #38bdf8; padding: 14px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; color: #cbd5e1; line-height: 1.5; }
    .footer { background: #0b1120; padding: 16px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">CHỨNG THƯ HIỆP SĨ PHẢN ỨNG NHANH</div>
      <h1 style="margin: 0; color: #ffffff; font-size: 22px;">QUYẾT ĐỊNH BỔ NHIỆM CHÍNH THỨC</h1>
      <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">Hội đồng Thẩm định Chuyên môn SafeSolo TOC</p>
    </div>
    <div class="content">
      <p style="font-size: 14.5px; color: #e2e8f0; line-height: 1.6;">
        Kính gửi Đồng chí / Hiệp sĩ <strong>${heroName}</strong>,<br>
        Hội đồng Thẩm định TOC đã hoàn tất đối soát hồ sơ và xác nhận bạn đáp ứng 100% tiêu chuẩn năng lực cứu hộ ngoại viện chuyên nghiệp.
      </p>

      <div class="card-id">
        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">KHỐI NGÀNH CHUYÊN MÔN:</div>
        <div style="font-size: 15px; font-weight: 800; color: ${profColor}; margin-bottom: 10px;">${profTitle}</div>

        <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.6;">
          • <strong>Số hiệu CCHN / Giấy phép:</strong> <code style="color: #ffffff; background: #0f172a; padding: 2px 6px; border-radius: 4px;">${certNum}</code><br>
          • <strong>Đơn vị công tác:</strong> ${unit}<br>
          • <strong>Bậc phân hạng:</strong> ${tier}<br>
          • <strong>Phạm vi tác chiến:</strong> ${scopeDesc}
        </div>
      </div>

      <div class="legal-box">
        ⚖️ <strong>Lá Chắn Pháp Lý Bảo Trợ:</strong><br>
        Căn cứ <strong>Điều 87 Luật Khám bệnh, chữa bệnh 2023</strong>; Điều 23 & Điều 132 Bộ luật Hình sự 2015. Bạn được pháp luật bảo vệ tính mạng, danh dự và miễn trừ trách nhiệm dân sự khi thực hiện sơ cứu nhân đạo. Quỹ HeroShield bảo trợ <strong>500.000.000đ</strong> chi phí hỗ trợ pháp lý và <strong>100.000.000đ</strong> bảo hiểm rủi ro tai nạn / phơi nhiễm y tế.
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <p style="font-size: 13px; color: #94a3b8;">Mở ứng dụng SafeSolo để kích hoạt Bàn Tác Chiến Radar và tiếp nhận ca cứu nạn quanh bạn!</p>
      </div>
    </div>
    <div class="footer">
      © 2026 SafeSolo Emergency Response TOC · Chứng chỉ điện tử bảo mật SHA-256
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to,
      subject,
      html,
      text: `[SAFESOLO] Chúc mừng ${heroName}! Bạn đã chính thức được bổ nhiệm Hiệp Sĩ ${profTitle} (Số hiệu: ${certNum}). Mở app SafeSolo để nhận ca ngay!`,
    });
  }

  /**
   * Template email: Thư Từ Chối KYC & Hướng Dẫn Bổ Sung
   */
  async sendHeroKycRejectedEmail(user, reason = 'Hồ sơ chưa đáp ứng tiêu chuẩn') {
    const to = user.email;
    if (!to) return { success: false, error: 'User has no email' };
    const name = user.fullName || 'Bạn';

    const subject = `⚠️ [SAFESOLO] THÔNG BÁO KẾT QUẢ THẨM ĐỊNH HỒ SƠ HIỆP SĨ`;
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Kết quả thẩm định KYC SafeSolo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 20px; color: #f1f5f9; }
    .container { max-width: 560px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #eab308; overflow: hidden; }
    .header { background: #1e293b; padding: 24px; text-align: center; border-bottom: 2px solid #eab308; }
    .content { padding: 24px; }
    .reason-box { background: rgba(234, 179, 8, 0.15); border: 1px solid #eab308; border-radius: 10px; padding: 14px; margin: 16px 0; color: #fef08a; font-size: 13px; line-height: 1.5; }
    .footer { background: #0b1120; padding: 16px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #facc15;">THÔNG BÁO THẨM ĐỊNH HỒ SƠ</h2>
      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 12.5px;">Hội đồng Chuyên môn Cấp cứu SafeSolo TOC</p>
    </div>
    <div class="content">
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
        Chào bạn <strong>${name}</strong>,<br>
        Cảm ơn tinh thần nhiệt huyết của bạn dành cho cộng đồng. Sau khi đối soát, hồ sơ của bạn chưa đủ điều kiện thăng hạng Hiệp Sĩ Phản Ứng Nhanh vì lý do sau:
      </p>
      <div class="reason-box">
        📋 <strong>Lý do từ chối:</strong><br>
        ${reason}
      </div>
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
        Theo quy định tại <strong>Điều 87 Luật Khám bệnh, chữa bệnh 2023</strong>, thành viên tham gia phản ứng nhanh ngoại viện bắt buộc phải có chứng chỉ chuyên môn (Y tế, Công an, PCCC, hoặc Cứu hộ dã ngoại WFR) và vượt qua bài sát hạch lâm sàng tối thiểu 18/20 điểm.
      </p>
      <p style="color: #38bdf8; font-size: 13px;">
        👉 Bạn có thể nộp bổ sung bằng cấp hoặc thi lại bài sát hạch lâm sàng bất kỳ lúc nào trên ứng dụng SafeSolo.
      </p>
    </div>
    <div class="footer">
      © 2026 SafeSolo Emergency Response TOC
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to,
      subject,
      html,
      text: `[SAFESOLO] Hồ sơ Hiệp sĩ của bạn chưa đạt yêu cầu: ${reason}. Vui lòng mở app SafeSolo để bổ sung chứng chỉ theo hướng dẫn.`,
    });
  }

  /**
   * Template email: Cấp Voucher Bồi Hoàn Vật Tư Tiêu Hao FPT Long Châu (SBAR Restock)
   */
  async sendHeroShieldVoucherEmail(user, voucherData) {
    const to = user.email;
    if (!to) return { success: false, error: 'User has no email' };

    const heroName = user.fullName || 'Hiệp Sĩ SafeSolo';
    const code = voucherData.voucherCode || 'RESTOCK-LONGCHAU-8821';
    const items = voucherData.itemsGranted || '2 Gạc vô trùng 10x10cm • 1 Băng ép garô CAT • 1 Mặt nạ CPR bỏ túi';
    const expiresAt = voucherData.expiresAt ? new Date(voucherData.expiresAt).toLocaleDateString('vi-VN') : '30 ngày tới';

    const subject = `🎁 [HEROSHIELD] VOUCHER BỒI HOÀN VẬT TƯ Y TẾ MIỄN PHÍ: ${code}`;
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Voucher Bồi Hoàn HeroShield</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 20px; color: #f1f5f9; }
    .container { max-width: 560px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 2px solid #f59e0b; overflow: hidden; }
    .header { background: linear-gradient(135deg, #78350f 0%, #451a03 100%); padding: 24px; text-align: center; }
    .content { padding: 24px; }
    .code-box { background: #1e293b; border: 2px dashed #f59e0b; border-radius: 12px; padding: 18px; text-align: center; margin: 18px 0; }
    .code-val { font-family: 'SF Mono', Consolas, monospace; font-size: 26px; font-weight: 800; color: #fbbf24; letter-spacing: 2px; }
    .footer { background: #0b1120; padding: 16px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #ffffff;">🎁 LÁ CHẮN BẢO HIỂM HEROSHIELD</h2>
      <p style="margin: 4px 0 0; color: #fde68a; font-size: 13px;">Bồi hoàn vật tư tiêu hao khẩn cấp sau ca cứu nạn</p>
    </div>
    <div class="content">
      <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6;">
        Chào Hiệp sĩ <strong>${heroName}</strong>,<br>
        Dựa trên biên bản bàn giao cấp cứu SBAR cho đội ngũ 115, Quỹ HeroShield trân trọng gửi bạn mã voucher nhận bù vật tư y tế cá nhân miễn phí:
      </p>

      <div class="code-box">
        <div style="font-size: 11px; color: #94a3b8; font-weight: bold; text-transform: uppercase; margin-bottom: 6px;">MÃ VOUCHER ĐỔI VẬT TƯ:</div>
        <div class="code-val">${code}</div>
        <div style="font-size: 12px; color: #38bdf8; margin-top: 6px;">Hạn dùng: ${expiresAt}</div>
      </div>

      <div style="background: #1e293b; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
        <div style="font-size: 12px; color: #f59e0b; font-weight: bold; margin-bottom: 6px;">📦 VẬT TƯ ĐƯỢC NHẬN MIỄN PHÍ:</div>
        <div style="font-size: 13px; color: #f8fafc; line-height: 1.5;">${items}</div>
      </div>

      <p style="color: #94a3b8; font-size: 12.5px; line-height: 1.5;">
        🏥 <strong>Điểm áp dụng:</strong> Đưa mã voucher này tại bất kỳ chi nhánh <strong>Nhà thuốc FPT Long Châu</strong> hoặc <strong>Pharmacity</strong> trên toàn quốc để nhận vật tư ngay tại quầy!
      </p>
    </div>
    <div class="footer">
      © 2026 SafeSolo HeroShield · Quỹ Bảo Trợ Hiệp Sĩ Ngoại Viện
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to,
      subject,
      html,
      text: `[HEROSHIELD] Mã voucher bồi hoàn vật tư của bạn là: ${code}. Đổi vật tư miễn phí tại Nhà thuốc Long Châu toàn quốc. Hạn dùng: ${expiresAt}.`,
    });
  }

  /**
   * Template email: Lệnh Điều Phối Tiếp Sức Máu Hiếm Khẩn Cấp SafeBlood Relay
   */
  async sendSafeBloodRelayAlertEmail(donor, bloodRequest) {
    const to = donor.email;
    if (!to) return { success: false, error: 'Donor has no email' };

    const donorName = donor.fullName || 'Tình nguyện viên SafeBlood';
    const hospital = bloodRequest.hospitalName || 'Bệnh viện Chợ Rẫy TP.HCM';
    const bloodType = bloodRequest.targetBloodGroup || 'O-';
    const fastTrackQr = bloodRequest.fastTrackQr || 'FAST-TRACK-CR-STAT-0992';

    const subject = `🩸 [SAFEBLOOD STAT] KHẨN CẤP: BỆNH VIỆN CẦN NHÓM MÁU HIẾM ${bloodType}!`;
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Lệnh điều phối máu SafeBlood</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; margin: 0; padding: 20px; color: #f1f5f9; }
    .container { max-width: 560px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 2px solid #dc2626; overflow: hidden; }
    .header { background: linear-gradient(135deg, #991b1b 0%, #450a0a 100%); padding: 26px; text-align: center; }
    .content { padding: 24px; }
    .qr-card { background: #ffffff; color: #0f172a; border-radius: 12px; padding: 18px; text-align: center; margin: 18px 0; }
    .footer { background: #0b1120; padding: 16px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0; color: #ffffff;">🩸 MẠNG LƯỚI TIẾP SỨC MÁU HIẾM SAFEBLOOD</h2>
      <p style="margin: 4px 0 0; color: #fca5a5; font-size: 13px;">Lệnh Điều Phối Khẩn Cấp Bệnh Viện Hạng 1</p>
    </div>
    <div class="content">
      <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6;">
        Kính gửi Bạn <strong>${donorName}</strong>,<br>
        <strong>${hospital}</strong> vừa phát lệnh điều phối khẩn cấp (STAT) cần <strong>nhóm máu hiếm ${bloodType}</strong> để cấp cứu ca mổ nguy kịch. Hệ thống SafeBlood nhận diện bạn có nhóm máu tương thích sinh học hoàn hảo!
      </p>

      <div class="qr-card">
        <div style="font-size: 12px; color: #dc2626; font-weight: 800; text-transform: uppercase;">THẺ FAST-TRACK ƯU TIÊN VÀO PHÒNG LẤY MÁU</div>
        <div style="font-family: monospace; font-size: 20px; font-weight: 800; color: #0f172a; margin: 8px 0;">${fastTrackQr}</div>
        <div style="font-size: 11.5px; color: #475569;">Đưa mã này tại Bàn Hướng Dẫn Cấp Cứu ${hospital} để vào thẳng không cần bốc số!</div>
      </div>

      <p style="color: #94a3b8; font-size: 12.5px; line-height: 1.5;">
        🌟 <strong>Quyền lợi nhân đạo:</strong> Tình nguyện viên tham gia hiến máu khẩn cấp sẽ được cộng ngay <strong>+25 điểm Trust Score</strong> và cấp huy hiệu Trái Tim Vàng trên hệ thống SafeSolo.
      </p>
    </div>
    <div class="footer">
      © 2026 SafeSolo SafeBlood Relay · Ngân Hàng Máu Khẩn Cấp Ngoại Viện
    </div>
  </div>
</body>
</html>
    `;

    return this.sendMail({
      to,
      subject,
      html,
      text: `[SAFEBLOOD] ${hospital} khẩn cấp cần nhóm máu hiếm ${bloodType}. Mã ưu tiên Fast-Track của bạn: ${fastTrackQr}. Mở app SafeSolo để nhận chỉ đường ngay!`,
    });
  }
}

module.exports = new EmailService();
