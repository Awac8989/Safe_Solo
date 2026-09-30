require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

async function main() {
  const gmailUser = process.env.GMAIL_USER ? process.env.GMAIL_USER.trim() : '';
  const appPassword = process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.trim().replace(/\s+/g, '') : '';
  const targetEmail = process.argv[2] || gmailUser;

  console.log('--- KIỂM TRA CẤU HÌNH GMAIL SMTP SAFESOLO ---');
  console.log(`GMAIL_USER: "${gmailUser || '(Chưa điền)'}"`);
  console.log(`GMAIL_APP_PASSWORD: "${appPassword ? '**** **** **** ' + appPassword.slice(-4) : '(Chưa điền)'}"`);
  console.log(`Email nhận thử: "${targetEmail || '(Chưa xác định)'}"`);

  if (!gmailUser || !gmailUser.includes('@')) {
    console.error('\n❌ LỖI: Biến GMAIL_USER trong file backend/.env chưa được điền địa chỉ Gmail!');
    console.error('👉 Vui lòng mở file backend/.env và nhập: GMAIL_USER=diachiemail@gmail.com');
    process.exit(1);
  }

  if (!appPassword || appPassword.length < 16) {
    console.error('\n❌ LỖI: Mật khẩu ứng dụng GMAIL_APP_PASSWORD không hợp lệ (cần đúng 16 ký tự)!');
    process.exit(1);
  }

  console.log('\n[1/3] Đang kết nối tới máy chủ Google SMTP (smtp.gmail.com:465)...');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: appPassword,
    },
  });

  try {
    await transporter.verify();
    console.log('✅ Xác thực tài khoản Google SMTP thành công 100%!');
  } catch (err) {
    console.error('❌ Lỗi xác thực tài khoản Google:', err.message);
    if (err.message.includes('Invalid login') || err.message.includes('Username and Password not accepted')) {
      console.error('💡 Gợi ý: Hãy kiểm tra chắc chắn rằng mã mật khẩu ứng dụng (App Password) được tạo từ chính tài khoản Gmail: ' + gmailUser);
    }
    process.exit(1);
  }

  console.log(`\n[2/3] Đang gửi thử email mã OTP đến: ${targetEmail}...`);
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
  
  const mailOptions = {
    from: `"SafeSolo Security" <${gmailUser}>`,
    to: targetEmail,
    subject: `[SafeSolo] Mã xác thực thử nghiệm Gmail SMTP: ${testOtp}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 20px; border-radius: 8px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0;">🛡️ SafeSolo Live Email Test</h2>
          <p style="margin: 6px 0 0 0; opacity: 0.9;">Kiểm tra kết nối Gmail SMTP thời gian thực</p>
        </div>
        <div style="padding: 24px 10px;">
          <p>Xin chào <strong>${targetEmail}</strong>,</p>
          <p>Chúc mừng bạn! Hệ thống máy chủ <strong>SafeSolo</strong> đã kết nối thành công với Google SMTP của bạn.</p>
          <div style="background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0;">
            <div style="font-size: 13px; color: #15803d; font-weight: bold; margin-bottom: 6px;">MÃ OTP XÁC THỰC THỬ NGHIỆM</div>
            <div style="font-size: 36px; font-weight: 800; color: #0f172a; letter-spacing: 6px;">${testOtp}</div>
          </div>
          <p style="color: #64748b; font-size: 13px;">Thư này được gửi tự động để kiểm tra tính năng cấp mã OTP và đặt lại mật khẩu cho Đề tài SafeSolo.</p>
        </div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
          © 2026 SafeSolo Inc. - Hệ thống bảo vệ an toàn cá nhân & Cứu hộ độc lập
        </div>
      </div>
    `,
    text: `[SafeSolo] Mã OTP thử nghiệm của bạn là: ${testOtp}. Chúc mừng hệ thống đã gửi thư thành công!`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('\n[3/3] 🎉 GỬI EMAIL THÀNH CÔNG RỰC RỠ!');
    console.log(`- Message ID: ${info.messageId}`);
    console.log(`- Đến hòm thư: ${targetEmail}`);
    console.log(`- Mã OTP đã tạo: ${testOtp}`);
    console.log('👉 Vui lòng mở hòm thư Gmail của bạn (kiểm tra cả mục Hộp thư đến / Thư rác Spam) để kiểm tra!');
  } catch (sendErr) {
    console.error('❌ Lỗi khi gửi email:', sendErr.message);
    process.exit(1);
  }
}

main();
