function verificationEmail({ username, verifyUrl }) {
    return {
        subject: 'Verify your Study Hero email',
        text: `Hi ${username},\n\nVerify your email address: ${verifyUrl}\n\nIf you did not create this account, you can ignore this email.`,
        html: `<p>Hi ${username},</p><p>Verify your email address:</p><p><a href="${verifyUrl}">Verify Email</a></p><p>If you did not create this account, you can ignore this email.</p>`
    };
}

function resetPasswordEmail({ username, resetUrl }) {
    return {
        subject: 'Reset your Study Hero password',
        text: `Hi ${username},\n\nReset your password: ${resetUrl}\n\nThis link expires soon. If you did not request it, ignore this email.`,
        html: `<p>Hi ${username},</p><p>Reset your password:</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires soon. If you did not request it, ignore this email.</p>`
    };
}

module.exports = { verificationEmail, resetPasswordEmail };