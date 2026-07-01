const nodemailer = require('nodemailer');
const { verificationEmail, resetPasswordEmail } = require('../email/templates');

function isEmailConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM);
}

function createTransport() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    });
}

async function sendEmail({ to, subject, text, html }) {
    if (!isEmailConfigured()) {
        console.warn(`Email not configured. Skipping email to ${to}: ${subject}`);
        return { skipped: true };
    }

    const transport = createTransport();
    await transport.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
        html
    });
    return { skipped: false };
}

async function sendVerificationEmail({ to, username, token }) {
    const frontendUrl = process.env.APP_URL || process.env.FRONTEND_URL;
    const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    return sendEmail({ to, ...verificationEmail({ username, verifyUrl }) });
}

async function sendPasswordResetEmail({ to, username, token }) {
    const frontendUrl = process.env.APP_URL || process.env.FRONTEND_URL;
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    return sendEmail({ to, ...resetPasswordEmail({ username, resetUrl }) });
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    isEmailConfigured
};