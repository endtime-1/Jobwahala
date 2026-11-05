import nodemailer from 'nodemailer';
import env from '../config/env';
import { escapeHtml } from '../utils/sharePage';

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
    .header { background: linear-gradient(135deg, #14306b 0%, #2f6df6 100%); padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; }
    .body { padding: 40px; color: #e0e0e0; line-height: 1.7; font-size: 15px; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; padding: 14px 32px; background: #2f6df6; color: #fff !important; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase; }
    .btn:hover { background: #1e4fd6; }
    .code { display: inline-block; padding: 12px 24px; background: rgba(47,109,246,0.15); border: 1px solid rgba(47,109,246,0.3); border-radius: 8px; font-family: monospace; font-size: 18px; font-weight: 700; color: #7aa2ff; letter-spacing: 2px; }
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
      <h1>${APP_NAME}</h1>
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
      <h1>${APP_NAME}</h1>
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

export const sendJobExpiryWarningEmail = async (
  email: string,
  job: { title: string; closesAt: Date; extendUrl: string; company?: string | null },
) => {
  const e = escapeHtml;
  const closing = job.closesAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  const html = wrapHtml(`
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>Your job is about to close</p>
    </div>
    <div class="body">
      <p><strong>${e(job.title)}</strong>${job.company ? ` at ${e(job.company)}` : ''} stops taking applications on <strong>${e(closing)}</strong>.</p>
      <p>Still hiring? Extend it and it stays on the board. Everyone who has already applied stays on your applicant board either way.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${job.extendUrl}" class="btn">Extend this job</a>
      </p>
      <p class="muted">Or copy this link into your browser:</p>
      <p class="muted" style="word-break: break-all;">${job.extendUrl}</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: `Your job "${job.title}" closes soon`,
    html,
  });
};

export const sendApplicationStatusEmail = async (
  email: string,
  update: { title: string; message: string; jobTitle: string; company: string },
) => {
  const e = escapeHtml;
  const url = `${env.frontendBaseUrl}/applications`;

  const html = wrapHtml(`
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>An update on your application</p>
    </div>
    <div class="body">
      <p style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${e(update.title)}</p>
      <p class="muted" style="margin-top: 0;">${e(update.jobTitle)} · ${e(update.company)}</p>
      <p>${e(update.message)}</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${url}" class="btn">See my applications</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: update.title,
    html,
  });
};

export const sendApplicationReminderEmail = async (
  email: string,
  reminder: { waiting: number; days: number; jobs: { title: string; waiting: number }[] },
) => {
  const e = escapeHtml;
  const url = `${env.frontendBaseUrl}/dashboard`;
  const people = reminder.waiting === 1 ? '1 applicant has' : `${reminder.waiting} applicants have`;
  const subjectPeople = reminder.waiting === 1 ? '1 applicant is' : `${reminder.waiting} applicants are`;
  const rows = reminder.jobs.map((job) => `<li>${e(job.title)}: ${job.waiting} waiting</li>`).join('');

  const html = wrapHtml(`
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>People are waiting to hear from you</p>
    </div>
    <div class="body">
      <p>${people} been waiting ${reminder.days} days or more without a reply.</p>
      <ul>${rows}</ul>
      <p>A short answer, even a polite no, goes a long way. Move each person to Shortlisted, Interview or Not selected and we will let them know.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${url}" class="btn">Review applicants</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: `${subjectPeople} waiting for your reply`,
    html,
  });
};

export const sendJobAlertEmail = async (
  email: string,
  alert: { alertName: string; jobTitle: string; company: string; location?: string | null; jobId: string },
) => {
  const jobUrl = `${env.frontendBaseUrl}/jobs/${alert.jobId}`;
  const e = escapeHtml;

  const html = wrapHtml(`
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>New job for your alert</p>
    </div>
    <div class="body">
      <p>A new role matches your saved search <strong>${e(alert.alertName)}</strong>:</p>
      <p style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${e(alert.jobTitle)}</p>
      <p class="muted" style="margin-top: 0;">${e(alert.company)}${alert.location ? ` · ${e(alert.location)}` : ''}</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${jobUrl}" class="btn">View the job</a>
      </p>
      <p class="muted">You can pause or delete this alert any time from the Jobs page.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: `New job: ${alert.jobTitle}`,
    html,
  });
};

export const sendVerificationCodeEmail = async (email: string, code: string, company?: string | null) => {
  const e = escapeHtml;

  const html = wrapHtml(`
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>Confirm your company email</p>
    </div>
    <div class="body">
      <p>Use this code to confirm this email address${company ? ` for <strong>${e(company)}</strong>` : ''} on ${APP_NAME}:</p>
      <p style="text-align: center; margin: 28px 0;"><span class="code">${e(code)}</span></p>
      <p class="muted">The code works for 10 minutes. If you did not ask for it, you can ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: `${code} is your ${APP_NAME} confirmation code`,
    html,
  });
};

export const sendVerificationDecisionEmail = async (email: string, update: { title: string; message: string }) => {
  const e = escapeHtml;
  const url = `${env.frontendBaseUrl}/dashboard`;

  const html = wrapHtml(`
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>An update on your verification</p>
    </div>
    <div class="body">
      <p style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">${e(update.title)}</p>
      <p>${e(update.message)}</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${url}" class="btn">Open my dashboard</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: update.title,
    html,
  });
};

// ---- Billing

const billingMail = async (email: string, subject: string, heading: string, lines: string[], button: { label: string; path: string }) => {
  const e = escapeHtml;
  const html = wrapHtml(`
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>${e(heading)}</p>
    </div>
    <div class="body">
      ${lines.map((line) => `<p>${e(line)}</p>`).join('\n')}
      <p style="text-align: center; margin: 32px 0;">
        <a href="${env.frontendBaseUrl}${button.path}" class="btn">${e(button.label)}</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  await transporter.sendMail({ from: env.smtpFrom, to: email, subject, html });
};

/** Sent when a payment is confirmed. The receipt itself (with VAT) is on the billing page. */
export const sendPaymentReceiptEmail = (email: string, data: { receiptNumber: string; productName: string; total: string; vat: string }) =>
  billingMail(
    email,
    `Your ${APP_NAME} receipt ${data.receiptNumber}`,
    'Payment received',
    [`Thank you. We received ${data.total} for ${data.productName}.`, `Receipt ${data.receiptNumber}. VAT included: ${data.vat}.`, 'You can download the full receipt from your billing page.'],
    { label: 'Open my billing page', path: '/billing' },
  );

export const sendRenewalReminderEmail = (email: string, data: { planName: string; renewsOn: string; amount: string }) =>
  billingMail(
    email,
    `Your ${APP_NAME} plan renews on ${data.renewsOn}`,
    'Your plan renews soon',
    [`Your ${data.planName} plan renews on ${data.renewsOn}. We will charge ${data.amount} to the payment method you used.`, 'If you do not want to renew, you can cancel on your billing page before then.'],
    { label: 'Manage my plan', path: '/billing' },
  );

export const sendPaymentFailedEmail = (email: string, data: { productName: string; reason?: string | null; graceEndsOn?: string }) =>
  billingMail(
    email,
    `Your ${APP_NAME} payment did not go through`,
    'Payment problem',
    [
      `We could not take the payment for ${data.productName}.${data.reason ? ` The bank said: ${data.reason}.` : ''}`,
      data.graceEndsOn ? `Your plan keeps working until ${data.graceEndsOn} while you put this right. After that your company moves to the Free plan. Nothing is deleted.` : 'Nothing has been charged for this attempt. You can try again, or use a different card or mobile money number.',
    ],
    { label: 'Go to my billing page', path: '/billing' },
  );

/** During the 7-day grace period after a failed renewal: how long is left, and what to do. */
export const sendGraceReminderEmail = (email: string, data: { planName: string; endsOn: string; lastChance: boolean }) =>
  billingMail(
    email,
    data.lastChance ? `Last chance to keep your ${APP_NAME} ${data.planName} plan` : `Your ${APP_NAME} ${data.planName} plan needs a payment`,
    data.lastChance ? 'Your plan ends tomorrow' : 'Your plan payment is overdue',
    [
      `We could not take the payment for your ${data.planName} plan. It keeps working until ${data.endsOn}.`,
      'After that your company moves to the Free plan. Nothing is deleted: your jobs, applicants and company page stay safe, and your team members are only paused.',
      'Update your payment method, or choose the plan again, to keep everything switched on.',
    ],
    { label: 'Fix my payment', path: '/plans' },
  );

/** A saved CV database search has new matching people. Says how many; no personal details go in an email. */
export const sendCandidateAlertEmail = (email: string, data: { searchName: string; count: number; url: string }) => {
  const e = escapeHtml;
  const html = wrapHtml(`
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>New candidates for your saved search</p>
    </div>
    <div class="body">
      <p>${data.count} new ${data.count === 1 ? 'person matches' : 'people match'} your saved search <strong>${e(data.searchName)}</strong> in the CV database.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${data.url}" class="btn">See the candidates</a>
      </p>
      <p class="muted">You can turn these alerts off for a search on the CV database page.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  return transporter.sendMail({ from: env.smtpFrom, to: email, subject: `New candidates for "${data.searchName}"`, html });
};

/** Invitation to join a company's team on JobWahala. */
export const sendTeamInviteEmail = (email: string, data: { company: string; url: string }) => {
  const e = escapeHtml;
  const html = wrapHtml(`
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>You have been invited to a team</p>
    </div>
    <div class="body">
      <p>${e(data.company)} invited you to help with hiring on ${APP_NAME}: posting jobs and reviewing applicants.</p>
      <p>Sign up or log in with this email address (${e(email)}) as an employer, then open the link below to accept.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${data.url}" class="btn">Accept the invitation</a>
      </p>
      <p class="muted">If you were not expecting this, you can ignore it.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  `);

  return transporter.sendMail({ from: env.smtpFrom, to: email, subject: `${data.company} invited you to their ${APP_NAME} team`, html });
};
