import nodemailer from 'nodemailer';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'test@gmail.com',
    pass: process.env.EMAIL_PASS || 'password',
  },
});

export const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;
    const mailOptions = {
      from: `"HolidayBnB" <${process.env.EMAIL_USER || 'test@gmail.com'}>`,
      to: email,
      subject: 'Reset Your HolidayBnB Password',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px;">
          <h2 style="color: #2563eb;">HolidayBnB</h2>
          <p>We received a request to reset your password.</p>
          <p>Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">Reset Password</a>
          <p style="color: #64748b; font-size: 13px;">This link expires in 1 hour.</p>
          <p style="color: #64748b; font-size: 13px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${email}`);
  } catch (error) {
    logger.error(`Error sending password reset email to ${email}: ${error.message}`);
    throw new Error('Failed to send password reset email');
  }
};

export const sendOTP = async (email, otp) => {
  try {
    const mailOptions = {
      from: `"HolidayBnB" <${process.env.EMAIL_USER || 'test@gmail.com'}>`,
      to: email,
      subject: 'Your HolidayBnB Login OTP',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">HolidayBnB Security</h2>
          <p>Your one-time password (OTP) for login is:</p>
          <h1 style="background: #f1f5f9; padding: 10px; display: inline-block; border-radius: 8px; letter-spacing: 2px;">${otp}</h1>
          <p>This code is valid for 5 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`OTP sent to ${email}`);
  } catch (error) {
    logger.error(`Error sending email to ${email}: ${error.message}`);
    throw new Error('Failed to send OTP email');
  }
};
