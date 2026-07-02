const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const notificationService = require('../services/notificationService');
const { emitToUser } = require('../socket/socketEmitter');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 100);
        const offset = Math.max(Number(req.query.offset || 0), 0);
        const unreadOnly = req.query.unreadOnly === 'true';
        const notifications = await notificationService.listNotifications(req.user.id, { limit, offset, unreadOnly });
        res.json(notifications);
    } catch (error) {
        console.error('Notification list error:', error);
        res.status(500).json({ error: 'Failed to load notifications' });
    }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
    try {
        const unreadCount = await notificationService.getUnreadCount(req.user.id);
        res.json({ unreadCount });
    } catch (error) {
        console.error('Notification count error:', error);
        res.status(500).json({ error: 'Failed to load notification count' });
    }
});

router.patch('/:id/read', authMiddleware, async (req, res) => {
    try {
        const notification = await notificationService.markRead(req.user.id, req.params.id);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        const unreadCount = await notificationService.getUnreadCount(req.user.id);
        emitToUser(req.user.id, 'notification:read', { notificationId: Number(req.params.id), unreadCount });
        res.json({ notification, unreadCount });
    } catch (error) {
        console.error('Notification read error:', error);
        res.status(500).json({ error: 'Failed to mark notification read' });
    }
});

router.patch('/read-all', authMiddleware, async (req, res) => {
    try {
        const unreadCount = await notificationService.markAllRead(req.user.id);
        emitToUser(req.user.id, 'notification:read_all', { unreadCount });
        res.json({ unreadCount });
    } catch (error) {
        console.error('Notification read-all error:', error);
        res.status(500).json({ error: 'Failed to mark notifications read' });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const deleted = await notificationService.deleteNotification(req.user.id, req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        const unreadCount = await notificationService.getUnreadCount(req.user.id);
        emitToUser(req.user.id, 'notification:deleted', { notificationId: Number(req.params.id), unreadCount });
        res.json({ message: 'Notification deleted', unreadCount });
    } catch (error) {
        console.error('Notification delete error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

module.exports = router;