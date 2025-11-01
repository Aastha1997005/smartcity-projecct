const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");


const db = require("../db");

// Only service providers, doctors, and admin can create notifications
router.post("/send", authenticateToken, authorizeRoles("admin", "transport", "utility", "healthcare", "internet"), async (req, res) => {
  const { message, user_ids } = req.body;
  if (!message || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: "Message and user_ids array required" });
  }
  try {
    // Insert a notification for each user_id
    for (const user_id of user_ids) {
      await db.query(
        `INSERT INTO Notifications (user_id, message, is_read) VALUES (?, ?, false)`,
        [user_id, message]
      );
    }
    res.json({ message: `Notification sent to ${user_ids.length} users.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get notifications for the authenticated user (announcements page)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    // Fetch notifications intended for this user, most recent first
    const [rows] = await db.query('SELECT notification_id, user_id, message, is_read, created_at FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [userId]);
    // Map to announcement-style objects expected by frontend
    const mapped = (rows || []).map(r => ({
      id: r.notification_id,
      title: '',
      content: r.message,
      is_read: !!r.is_read,
      created_at: r.created_at
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
