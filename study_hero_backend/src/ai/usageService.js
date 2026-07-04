const db = require('../config/db');

const DAILY_LIMIT = Number(process.env.AI_DAILY_TOKEN_LIMIT || 50000);
const MONTHLY_LIMIT = Number(process.env.AI_MONTHLY_TOKEN_LIMIT || 500000);

async function getUsageWindow(userId) {
    const [daily] = await db.query(`
        SELECT COALESCE(SUM(total_tokens), 0) AS tokens
        FROM ai_usage_logs
        WHERE user_id = ? AND created_at >= CURRENT_DATE()
    `, [userId]);
    const [monthly] = await db.query(`
        SELECT COALESCE(SUM(total_tokens), 0) AS tokens
        FROM ai_usage_logs
        WHERE user_id = ? AND created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
    `, [userId]);
    return { dailyTokens: Number(daily[0]?.tokens || 0), monthlyTokens: Number(monthly[0]?.tokens || 0), dailyLimit: DAILY_LIMIT, monthlyLimit: MONTHLY_LIMIT };
}

async function assertQuota(userId, estimatedTokens = 1000) {
    const usage = await getUsageWindow(userId);
    if (usage.dailyTokens + estimatedTokens > usage.dailyLimit) {
        const error = new Error('Daily AI usage limit exceeded');
        error.status = 429;
        error.usage = usage;
        throw error;
    }
    if (usage.monthlyTokens + estimatedTokens > usage.monthlyLimit) {
        const error = new Error('Monthly AI usage limit exceeded');
        error.status = 429;
        error.usage = usage;
        throw error;
    }
    return usage;
}

async function logUsage({ userId, feature, provider, model = null, inputTokens = 0, outputTokens = 0, latencyMs = 0, estimatedCost = 0, status = 'success', errorMessage = null }) {
    const totalTokens = Number(inputTokens || 0) + Number(outputTokens || 0);
    const [result] = await db.query(`
        INSERT INTO ai_usage_logs (user_id, feature, provider, model, input_tokens, output_tokens, total_tokens, latency_ms, estimated_cost, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, feature, provider, model, inputTokens, outputTokens, totalTokens, latencyMs, estimatedCost, status, errorMessage]);
    return result.insertId;
}

module.exports = { assertQuota, getUsageWindow, logUsage };