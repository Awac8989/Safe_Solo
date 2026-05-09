const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');

class AuthService {
  // Generate JWT token
  generateToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });
  }

  // Generate OTP code
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  // Hash OTP for storage (simple hash, not for passwords)
  hashOTP(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  // Send OTP via email (mock implementation - integrate with email service)
  async sendOTP(email, otp) {
    console.log(`OTP for ${email}: ${otp}`);
    return true;
  }

  // Register user and send OTP
  async register(userData) {
    const { email, phone, firstName, lastName, dateOfBirth, gender } = userData;

    // Check if user already exists
    const existingUser = await query(
      `SELECT * FROM users WHERE email = @Email OR phone = @Phone`,
      { Email: email, Phone: phone || null }
    );

    if (existingUser.recordset.length > 0) {
      throw new Error('User already exists with this email or phone');
    }

    // Generate OTP
    const otp = this.generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    const result = await query(
      `INSERT INTO users (email, phone, first_name, last_name, date_of_birth, gender, otp_code, otp_expires_at) 
       OUTPUT INSERTED.id, INSERTED.email, INSERTED.first_name, INSERTED.last_name, INSERTED.is_verified, INSERTED.created_at
       VALUES (@Email, @Phone, @FirstName, @LastName, @DateOfBirth, @Gender, @OtpCode, @OtpExpiresAt)`,
      {
        Email: email,
        Phone: phone || null,
        FirstName: firstName,
        LastName: lastName,
        DateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        Gender: gender,
        OtpCode: this.hashOTP(otp),
        OtpExpiresAt: otpExpiresAt
      }
    );

    const user = result.recordset[0];

    // Send OTP
    await this.sendOTP(email, otp);

    return {
      user,
      message: 'Registration successful. Please check your email for OTP verification.'
    };
  }

  // Login with email and send OTP
  async login(email) {
    const result = await query(
      `SELECT id, email, is_active, is_verified FROM users WHERE email = @Email`,
      { Email: email }
    );

    const user = result.recordset[0];

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Generate OTP
    const otp = this.generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with OTP
    await query(
      `UPDATE users SET otp_code = @OtpCode, otp_expires_at = @OtpExpiresAt WHERE id = @UserId`,
      {
        OtpCode: this.hashOTP(otp),
        OtpExpiresAt: otpExpiresAt,
        UserId: user.id
      }
    );

    // Send OTP
    await this.sendOTP(email, otp);

    return {
      message: 'OTP sent to your email. Please verify to complete login.'
    };
  }

  // Verify OTP and complete authentication
  async verifyOTP(email, otp) {
    const result = await query(
      `SELECT * FROM users WHERE email = @Email`,
      { Email: email }
    );

    const user = result.recordset[0];

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.otp_code || !user.otp_expires_at) {
      throw new Error('No OTP found. Please request a new one.');
    }

    if (new Date() > user.otp_expires_at) {
      throw new Error('OTP has expired. Please request a new one.');
    }

    if (this.hashOTP(otp) !== user.otp_code) {
      throw new Error('Invalid OTP');
    }

    // Clear OTP and mark as verified
    await query(
      `UPDATE users SET otp_code = NULL, otp_expires_at = NULL, is_verified = 1, last_login_at = GETUTCDATE() WHERE id = @UserId`,
      { UserId: user.id }
    );

    // Generate JWT token
    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isVerified: true
      },
      token
    };
  }

  // Get current user profile
  async getProfile(userId) {
    const result = await query(
      `SELECT id, email, phone, first_name, last_name, date_of_birth, gender, avatar, is_active, is_verified, last_login_at, created_at
       FROM users WHERE id = @UserId`,
      { UserId: userId }
    );

    const user = result.recordset[0];

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  // Update user profile
  async updateProfile(userId, updateData) {
    const { dateOfBirth, ...otherData } = updateData;

    const result = await query(
      `UPDATE users SET 
        first_name = @FirstName,
        last_name = @LastName,
        phone = @Phone,
        date_of_birth = @DateOfBirth,
        gender = @Gender,
        avatar = @Avatar
       OUTPUT INSERTED.*
       WHERE id = @UserId`,
      {
        UserId: userId,
        FirstName: otherData.firstName,
        LastName: otherData.lastName,
        Phone: otherData.phone,
        DateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        Gender: otherData.gender,
        Avatar: otherData.avatar
      }
    );

    return result.recordset[0];
  }

  // Deactivate account
  async deactivateAccount(userId) {
    await query(
      `UPDATE users SET is_active = 0 WHERE id = @UserId`,
      { UserId: userId }
    );

    return { message: 'Account deactivated successfully' };
  }
}

module.exports = new AuthService();