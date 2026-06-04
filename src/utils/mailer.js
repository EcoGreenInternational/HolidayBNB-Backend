import nodemailer from 'nodemailer';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'test@gmail.com',
    pass: process.env.EMAIL_PASS || 'password',
  },
});

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
