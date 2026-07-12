const db = require('../config/db');
const { json } = require('./performanceService');

function diffDays(a, b) {
    return Math.round((new Date(a).setHours(0,0,0,0) - new Date(b).setHours(0,0,0,0)) / 86400000);
}

async function computeLearningStreak(studentId) {
    const [rows] = await db.query(`
        SELECT DISTINCT DATE(activity_date) day FROM (
            SELECT submitted_at activity_date FROM quiz_attempts WHERE student_id = ? AND status = 'submitted'
            UNION ALL SELECT submitted_at FROM submissions WHERE student_id = ?
            UNION ALL SELECT created_at FROM activity_events WHERE actor_id = ? OR target_user_id = ?
            UNION ALL SELECT last_login_at FROM users WHERE id = ? AND last_login_at IS NOT NULL
        ) x WHERE activity_date IS NOT NULL ORDER BY day DESC LIMIT 120
    `, [studentId, studentId, studentId, studentId, studentId]);
    const days = rows.map((row) => row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10));
    const today = new Date().toISOString().slice(0, 10);
    let dailyStreak = 0;
    let cursor = days.includes(today) ? today : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    while (days.includes(cursor)) {
        dailyStreak += 1;
        cursor = new Date(new Date(cursor).getTime() - 86400000).toISOString().slice(0, 10);
    }
    let longest = 0;
    let current = 0;
    for (let i = days.length - 1; i >= 0; i--) {
        if (i === days.length - 1 || diffDays(days[i], days[i + 1]) === 1) current += 1; else current = 1;
        longest = Math.max(longest, current);
    }
    const weeklyStreak = new Set(days.map((day) => `${new Date(day).getFullYear()}-${Math.ceil((((new Date(day) - new Date(new Date(day).getFullYear(),0,1)) / 86400000) + new Date(new Date(day).getFullYear(),0,1).getDay()+1)/7)}`)).size;
    const missedDays = days.length ? Math.max(0, diffDays(today, days[days.length - 1]) + 1 - days.length) : 0;
    await db.query(`
        INSERT INTO learning_streaks (student_id, daily_streak, weekly_streak, longest_streak, missed_days, last_activity_date, active_days)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE daily_streak = VALUES(daily_streak), weekly_streak = VALUES(weekly_streak), longest_streak = GREATEST(longest_streak, VALUES(longest_streak)), missed_days = VALUES(missed_days), last_activity_date = VALUES(last_activity_date), active_days = VALUES(active_days)
    `, [studentId, dailyStreak, weeklyStreak, longest, missedDays, days[0] || null, json(days)]);
    return { dailyStreak, weeklyStreak, longestStreak: Math.max(longest, dailyStreak), missedDays, lastActivityDate: days[0] || null, activeDays: days };
}

module.exports = { computeLearningStreak };
