const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Create email transporter
 * In development/test without credentials, uses mock transport
 */
const createTransporter = () => {
  if (!config.email.user || !config.email.pass) {
    // Return mock transporter for development
    logger.info('Email credentials not configured, using mock transport');
    return {
      sendMail: async (mailOptions) => {
        logger.info('Mock email sent:', {
          to: mailOptions.to,
          subject: mailOptions.subject,
        });
        return { messageId: 'mock-' + Date.now() };
      },
    };
  }
  
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
};

const transporter = createTransporter();

/**
 * Send email
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const mailOptions = {
    from: config.email.from,
    to,
    subject,
    text,
    html,
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent:', { messageId: info.messageId, to });
    return info;
  } catch (error) {
    logger.error('Email send failed:', { error: error.message, to });
    throw error;
  }
};

/**
 * Send OTP email
 */
const sendOtpEmail = async (email, otp) => {
  const subject = 'Smart Cafe - Password Reset OTP';
  const text = `Your OTP for password reset is: ${otp}\n\nThis OTP is valid for ${config.otp.expiryMinutes} minutes.\n\nIf you didn't request this, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset OTP</h2>
      <p>Your OTP for password reset is:</p>
      <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #007bff; letter-spacing: 5px; margin: 0;">${otp}</h1>
      </div>
      <p>This OTP is valid for <strong>${config.otp.expiryMinutes} minutes</strong>.</p>
      <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
  
  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (email, name) => {
  const subject = 'Welcome to Smart Cafe!';
  const text = `Hi ${name},\n\nWelcome to Smart Cafe! Your account has been created successfully.\n\nYou can now login and start booking your meals.\n\nThank you!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to Smart Cafe!</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your account has been created successfully. You can now login and start booking your meals.</p>
      <p>Thank you for joining us!</p>
    </div>
  `;
  
  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send booking confirmation email
 */
const sendBookingConfirmation = async (email, booking) => {
  const subject = `Smart Cafe - Booking Confirmed (${booking.tokenNumber})`;
  const text = `Your booking has been confirmed!\n\nToken: ${booking.tokenNumber}\nSlot: ${booking.slotTime}\nTotal: ₹${booking.totalAmount}\n\nPlease show your token at the counter.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">Booking Confirmed!</h2>
      <div style="background: #f4f4f4; padding: 20px; margin: 20px 0;">
        <h1 style="text-align: center; margin: 0; color: #333;">${booking.tokenNumber}</h1>
      </div>
      <p><strong>Slot:</strong> ${booking.slotTime}</p>
      <p><strong>Total:</strong> ₹${booking.totalAmount}</p>
      <p style="color: #666;">Please show your token at the counter.</p>
    </div>
  `;
  
  return sendEmail({ to: email, subject, text, html });
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendWelcomeEmail,
  sendBookingConfirmation,
};
