const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");


const db = require("../db");

// Only service providers, doctors, and admin can create notifications
router.post("/send", authenticateToken, authorizeRoles("admin", "transport", "utility", "healthcare", "internet"), async (req, res) => {
  const { message, user_ids, all } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    let recipients = [];

    // If explicit user_ids provided, use them
    if (Array.isArray(user_ids) && user_ids.length > 0) {
      recipients = user_ids.map(id => parseInt(id)).filter(n => Number.isFinite(n));
    }

    // If no explicit recipients and caller is admin, treat as broadcast
    const callerRole = (req.user && req.user.role) || '';
    if ((!recipients || recipients.length === 0) && (all || callerRole === 'admin')) {
      // Only allow broadcast when the caller is an admin
      if (callerRole !== 'admin') return res.status(403).json({ error: 'Only admin may broadcast to all users' });

      const [rows] = await db.query('SELECT user_id FROM Users');
      recipients = (rows || []).map(r => r.user_id).filter(n => Number.isFinite(n));
    }

    if (!recipients || recipients.length === 0) {
      // For non-admin callers, require explicit recipients
      return res.status(400).json({ error: 'No recipients specified' });
    }

    // Prepare bulk insert values
    const values = recipients.map(u => [u, message, 0]);
    await db.query('INSERT INTO Notifications (user_id, message, is_read) VALUES ?', [values]);

    res.json({ message: `Notification sent to ${recipients.length} users.` });
  } catch (err) {
    console.error('notifications.send error', err);
    res.status(500).json({ error: err.message });
  }
});

// Get notifications for the authenticated user (announcements page)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    const requesterRole = req.user && req.user.role;

    // Admins can request all notifications with ?all=true or for a specific user with ?user_id=ID
    if (req.query.all === 'true') {
      if (requesterRole !== 'admin') return res.status(403).json({ error: 'Only admin may request all notifications' });
      const [rows] = await db.query('SELECT notification_id, user_id, message, is_read, created_at FROM Notifications ORDER BY created_at DESC LIMIT 1000');
      const mappedAll = (rows || []).map(r => ({ id: r.notification_id, title: '', content: r.message, is_read: !!r.is_read, created_at: r.created_at, user_id: r.user_id }));
      return res.json(mappedAll);
    }

    if (req.query.user_id) {
      // allow admin to fetch notifications for a specific user
      if (requesterRole !== 'admin') return res.status(403).json({ error: 'Only admin may request notifications for other users' });
      const targetId = parseInt(req.query.user_id);
      if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid user_id' });
      const [rows] = await db.query('SELECT notification_id, user_id, message, is_read, created_at FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000', [targetId]);
      const mapped = (rows || []).map(r => ({ id: r.notification_id, title: '', content: r.message, is_read: !!r.is_read, created_at: r.created_at }));
      return res.json(mapped);
    }

    // Default: return notifications for the authenticated user
    const [rows] = await db.query('SELECT notification_id, user_id, message, is_read, created_at FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [userId]);
    const mapped = (rows || []).map(r => ({ id: r.notification_id, title: '', content: r.message, is_read: !!r.is_read, created_at: r.created_at }));
    res.json(mapped);
  } catch (err) {
    console.error('notifications.get error', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
