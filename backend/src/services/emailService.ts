import nodemailer from 'nodemailer';
import env from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  auth:
    env.smtpUser && env.smtpPass
      ? { user: env.smtpUser, pass: env.smtpPass }
      : undefined,
});

const APP_NAME = 'JobWahala';

const wrapHtml = (body: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${APP_NAME}</title>
  <style>
    body { margin: 0; padding: 0; background: #0f0f0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 560px; margin: 40px auto; background: #1a1a1a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; }
    .body { padding: 40px; color: #e0e0e0; line-height: 1.7; font-size: 15px; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; padding: 14px 32px; background: #6c5ce7; color: #fff !important; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase; }
    .btn:hover { background: #5a4bd1; }
    .code { display: inline-block; padding: 12px 24px; background: rgba(108,92,231,0.15); border: 1px solid rgba(108,92,231,0.3); border-radius: 8px; font-family: monospace; font-size: 18px; font-weight: 700; color: #a29bfe; letter-spacing: 2px; }
    .footer { padding: 24px 40px; background: #141414; text-align: center; color: #666; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); }
    .muted { color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
  </div>
</body>
</html>
`;

export const sendVerificationEmail = async (email: string, token: string) => {
  const verifyUrl = `${env.frontendBaseUrl}/verify-email?token=${token}`;

  const html = wrapHtml(`
    <div class="header">
      <h1>🚀 ${APP_NAME}</h1>
      <p>Verify Your Email</p>
    </div>
    <div class="body">
      <p>Welcome to ${APP_NAME}! Please verify your email address to unlock your full workspace.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" class="btn">Verify Email Address</a>
      </p>
      <p class="muted">Or copy this link into your browser:</p>
      <p class="muted" style="word-break: break-all;">${verifyUrl}</p>
      <p class="muted">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: `Verify your ${APP_NAME} email`,
    html,
  });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${env.frontendBaseUrl}/reset-password?token=${token}`;

  const html = wrapHtml(`
    <div class="header">
      <h1>🔐 ${APP_NAME}</h1>
      <p>Reset Your Password</p>
    </div>
    <div class="body">
      <p>We received a request to reset the password for your account. Click the button below to set a new password.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </p>
      <p class="muted">Or copy this link into your browser:</p>
      <p class="muted" style="word-break: break-all;">${resetUrl}</p>
      <p class="muted">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html,
  });
};
