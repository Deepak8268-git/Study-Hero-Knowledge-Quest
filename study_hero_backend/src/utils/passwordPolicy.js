const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH || 8);

function validatePasswordStrength(password) {
    const errors = [];

    if (!password || password.length < PASSWORD_MIN_LENGTH) {
        errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
    }
    if (!/[a-z]/.test(password || '')) {
        errors.push('Password must include a lowercase letter');
    }
    if (!/[A-Z]/.test(password || '')) {
        errors.push('Password must include an uppercase letter');
    }
    if (!/[0-9]/.test(password || '')) {
        errors.push('Password must include a number');
    }
    if (!/[^A-Za-z0-9]/.test(password || '')) {
        errors.push('Password must include a special character');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = { validatePasswordStrength, PASSWORD_MIN_LENGTH };