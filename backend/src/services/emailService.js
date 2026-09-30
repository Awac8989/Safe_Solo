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
}

module.exports = new EmailService();
