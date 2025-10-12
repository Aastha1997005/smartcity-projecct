const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");


const db = require("../db");

// Only service providers, doctors, and admin can create notifications
router.post("/send", authenticateToken, authorizeRoles("admin", "provider", "doctor"), async (req, res) => {
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

module.exports = router;
