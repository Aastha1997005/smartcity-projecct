const express = require("express");
const router = express.Router();
const {db} = require("../db");

// Get all properties for a specific citizen (user)
router.get("/user/:user_id", async (req, res) => {
  const userId = req.params.user_id;
  try {
    // Try to resolve as a Users.user_id -> linked_id first
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [userId]);
    let citizenId = null;
    if (users.length && users[0].linked_id) {
      citizenId = users[0].linked_id;
    } else {
      // Fall back: assume caller passed a citizen_id already
      citizenId = userId;
    }

    const [rows] = await db.query(
      `SELECT h.* FROM House h JOIN Citizen c ON h.house_id = c.house_id WHERE c.citizen_id = ?`,
      [citizenId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
