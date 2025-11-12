const express = require("express");
const router = express.Router();
const db = require("../db"); // Adjust path if needed
const { authenticateToken, authorizeRoles } = require('../middleware/auth'); // Adjust path if needed

/**
 * GET /
 * (Mounted at /api/announcements)
 * Fetches all notifications, joining with users to show who received them.
 * This fixes the "Unknown column 'sender_id'" error.
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    // This query joins Notifications with Users to get the recipient's email
    // It assumes "announcements" means viewing all notifications sent.
        const [notifications] = await db.query(`
          SELECT
            n.notification_id,
            n.message,
            n.is_read,
            n.created_at,
            n.user_id AS recipient_user_id,
            u_recipient.email AS recipient_email,
            n.sender_id,
            u_sender.email AS sender_email
          FROM Notifications n
          JOIN Users u_recipient ON n.user_id = u_recipient.user_id
          LEFT JOIN Users u_sender ON n.sender_id = u_sender.user_id
          ORDER BY n.created_at DESC
          LIMIT 100
        `);
    
    res.json(notifications);

  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: "Database error while fetching notifications." });
  }
});

/**
 * POST /
 * (Mounted at /api/announcements)
 * Creates a new notification (announcement) for a specific user.
 * This is likely what your admin panel needs to do.
 */
router.post("/send", authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { message, recipient_user_id, all } = req.body; // Expects a message, a user ID, and an optional 'all' flag
  const senderId = req.user.id; // Get sender_id from authenticated user

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    if (all) {
      // Fetch all user IDs
      const [users] = await db.query('SELECT user_id FROM Users');
      if (!users.length) {
        return res.status(404).json({ error: "No users found to send announcement to." });
      }

      // Insert a notification for each user
      const insertPromises = users.map(user =>
        db.query('INSERT INTO Notifications (user_id, sender_id, message) VALUES (?, ?, ?)', [user.user_id, senderId, message])
      );
      await Promise.all(insertPromises);

      res.status(201).json({
        message: `Announcement sent to ${users.length} users successfully`,
      });

    } else {
      // Original logic: send to a specific user
      if (!recipient_user_id) {
        return res.status(400).json({ error: "Recipient user ID is required when not sending to all." });
      }
      const [result] = await db.query(
        'INSERT INTO Notifications (user_id, sender_id, message) VALUES (?, ?, ?)',
        [recipient_user_id, senderId, message]
      );

      res.status(201).json({
        message: 'Notification sent successfully',
        notification_id: result.insertId
      });
    }

  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ error: "Database error while creating notification." });
  }
});

module.exports = router;