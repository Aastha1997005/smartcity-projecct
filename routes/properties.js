const express = require("express");
const router = express.Router();
const {db} = require("../db");
const { authenticateToken } = require("../middleware/auth");

// Get all properties for the currently logged-in citizen
router.get("/my", authenticateToken, async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: "Authentication error: User ID not found." });

  try {
    // Resolve user's linked profile id (citizen_id)
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });
    const citizenId = users[0].linked_id;
    if (!citizenId) return res.status(400).json({ message: 'Profile incomplete. Please complete your profile before viewing your properties.' });

    const [rows] = await db.query(
      `SELECT * FROM Property WHERE owner_citizen_id = ?`,
      [citizenId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Database error fetching user's properties:", err);
    res.status(500).json({ message: "Failed to retrieve properties due to a server error." });
  }
});

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
      `SELECT * FROM Property WHERE owner_citizen_id = ?`,
      [citizenId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
