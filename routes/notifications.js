const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// Send notification to citizens (admin only)
router.post("/send", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  const { message, citizen_ids } = req.body;
  if (!message || !Array.isArray(citizen_ids) || citizen_ids.length === 0) {
    return res.status(400).json({ error: "Message and citizen_ids array required" });
  }
  // Here you would integrate with an actual notification service (email, SMS, etc.)
  // For now, just simulate success
  res.json({ message: `Notification sent to ${citizen_ids.length} citizens.` });
});

module.exports = router;
