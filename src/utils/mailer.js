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

export const sendHostApplicationEmail = async ({ name, email, phone, propertyName, propertyType, city, country, bedrooms, bathrooms, description, imageUrls }) => {
  try {
    const adminEmail = process.env.MAIL_TO || process.env.EMAIL_USER;
    const imagesHtml = imageUrls?.length
      ? `<div style="margin:12px 0"><strong style="font-size:13px;color:#334155;display:block;margin-bottom:8px">Property Images</strong>
         <div style="display:flex;flex-wrap:wrap;gap:8px">${imageUrls.map(url =>
           `<img src="${url}" style="width:200px;height:150px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0" />`
         ).join('')}</div></div>`
      : '';

    const mailOptions = {
      from: `"HolidayBnB Host Application" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      replyTo: email,
      subject: `New Host Application — ${propertyName} in ${city}, ${country}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px 32px">
            <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.02em">New Host Application</h1>
            <p style="color:#93c5fd;font-size:13px;margin:4px 0 0">A property owner wants to list on HolidayBnB</p>
          </div>
          <div style="padding:24px 32px">
            <h2 style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #2563eb">Contact Information</h2>
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#334155">
              <tr><td style="padding:4px 8px 4px 0;font-weight:600;width:120px;color:#64748b">Name</td><td>${name}</td></tr>
              <tr><td style="padding:4px 8px 4px 0;font-weight:600;color:#64748b">Email</td><td><a href="mailto:${email}" style="color:#2563eb">${email}</a></td></tr>
              <tr><td style="padding:4px 8px 4px 0;font-weight:600;color:#64748b">Phone</td><td>${phone || '—'}</td></tr>
            </table>

            <h2 style="font-size:15px;font-weight:700;color:#0f172a;margin:20px 0 12px;padding-bottom:8px;border-bottom:2px solid #2563eb">Property Details</h2>
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#334155">
              <tr><td style="padding:4px 8px 4px 0;font-weight:600;width:120px;color:#64748b">Property Name</td><td>${propertyName}</td></tr>
              <tr><td style="padding:4px 8px 4px 0;font-weight:600;color:#64748b">Type</td><td>${propertyType}</td></tr>
              <tr><td style="padding:4px 8px 4px 0;font-weight:600;color:#64748b">Location</td><td>${city}${country ? `, ${country}` : ''}</td></tr>
              <tr><td style="padding:4px 8px 4px 0;font-weight:600;color:#64748b">Bedrooms</td><td>${bedrooms || '—'}</td></tr>
              <tr><td style="padding:4px 8px 4px 0;font-weight:600;color:#64748b">Bathrooms</td><td>${bathrooms || '—'}</td></tr>
            </table>

            ${description ? `
            <h2 style="font-size:15px;font-weight:700;color:#0f172a;margin:20px 0 8px;padding-bottom:8px;border-bottom:2px solid #2563eb">Description</h2>
            <p style="font-size:13px;color:#475569;line-height:1.6;white-space:pre-wrap;margin:0">${description}</p>
            ` : ''}

            ${imagesHtml}

            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">
              Sent via HolidayBnB Host Application Form
            </div>
          </div>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    logger.info(`Host application email sent for ${propertyName} by ${email}`);
  } catch (error) {
    logger.error(`Error sending host application email: ${error.message}`);
    throw new Error('Failed to send host application email');
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
