const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all properties for a specific citizen (user)
router.get("/user/:user_id", async (req, res) => {
  const userId = req.params.user_id;
  try {
    const [rows] = await db.query(
      `SELECT * FROM Property WHERE owner_citizen_id = ?`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
