const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// Get audit logs (admin only)
router.get("/", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    const [logs] = await db.query("SELECT * FROM AuditLog ORDER BY timestamp DESC LIMIT 100");
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
