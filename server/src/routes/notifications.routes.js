const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { verifyToken } = require('../middleware/auth.middleware');

/**
 * GET /api/notifications
 * Get user's notifications
 */
router.get('/', verifyToken, (req, res) => {
  const userId = req.user.id;
  const notifications = db.prepare(`
    SELECT n.*, a.token_display
    FROM notifications n
    LEFT JOIN appointments a ON n.appointment_id = a.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 30
  `).all(userId);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
  `).get(userId)?.count || 0;

  return res.json({ notifications, unreadCount });
});

/**
 * POST /api/notifications/:id/read
 * Mark notification as read
 */
router.post('/:id/read', verifyToken, (req, res) => {
  db.prepare(`
    UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

  return res.json({ success: true });
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', verifyToken, (req, res) => {
  db.prepare(`
    UPDATE notifications SET is_read = 1 WHERE user_id = ?
  `).run(req.user.id);

  return res.json({ success: true });
});

module.exports = router;
