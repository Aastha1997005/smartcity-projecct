const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Register user
router.post("/register", async (req, res) => {
  const { email, password, role } = req.body;
  if (role && role.toLowerCase() === 'admin') {
    return res.status(403).json({ error: 'Cannot register as admin.' });
  }
  try {
    // Check if user already exists
    const [existing] = await db.query("SELECT * FROM Users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "You are already registered" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO Users (email, password_hash, role, linked_id) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, role, null]
    );
    res.json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
// Complete profile endpoint
router.post("/complete-profile", async (req, res) => {
  const { email, role } = req.body;
  try {
    // Find user
    const [users] = await db.query("SELECT * FROM Users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = users[0];
    let linked_id = null;
    if (role === 'citizen') {
      const { first_name, last_name, street, area, city, pincode, gender, dob, house_id } = req.body;
      const [result] = await db.query(
        `INSERT INTO Citizen (first_name, last_name, street, area, city, pincode, gender, dob, house_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [first_name, last_name, street, area, city, pincode, gender, dob, house_id]
      );
      linked_id = result.insertId;
    } else if (role === 'doctor') {
      const { name, specialisation } = req.body;
      const [result] = await db.query(
        `INSERT INTO Doctors (name, specialisation) VALUES (?, ?)`,
        [name, specialisation]
      );
      linked_id = result.insertId;
    } else if (role === 'provider') {
      const { name, contact_no, service_type } = req.body;
      const [result] = await db.query(
        `INSERT INTO Service_Provider (name, contact_no, service_type) VALUES (?, ?, ?)`,
        [name, contact_no, service_type]
      );
      linked_id = result.insertId;
    }
    // Update user with correct linked_id (profile id)
    await db.query("UPDATE Users SET linked_id = ? WHERE user_id = ?", [linked_id, user.user_id]);
    res.json({ message: "Profile completed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM Users WHERE email = ?", [
      email,
    ]);
    if (rows.length === 0)
      return res.status(400).json({ error: "User not found" });

    const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      "your_jwt_secret",
      { expiresIn: "1h" }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Change password (for logged-in users)
const { authenticateToken } = require("../middleware/auth");
router.put("/change-password", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new password required' });
  }
  try {
    // Get current password hash
    const [rows] = await db.query('SELECT password_hash FROM Users WHERE user_id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Old password incorrect' });
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE Users SET password_hash = ? WHERE user_id = ?', [newHash, userId]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
