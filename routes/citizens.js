
const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Get all dashboard data for a user (profile, vehicles, properties, bookings, complaints)
router.get('/dashboard/:user_id', async (req, res) => {
  const userId = req.params.user_id;
  try {
    // Get linked_id (citizen_id) for this user
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [userId]);
    if (!users.length || !users[0].linked_id) {
      return res.status(404).json({ error: 'Citizen not found for this user' });
    }
    const citizenId = users[0].linked_id;
    // Get citizen profile
    const [citizens] = await db.query('SELECT * FROM Citizen WHERE citizen_id = ?', [citizenId]);
    if (!citizens.length) {
      return res.status(404).json({ error: 'Citizen not found' });
    }
    // Get vehicles
    const [vehicles] = await db.query('SELECT * FROM Vehicle WHERE owner_citizen_id = ?', [citizenId]);
    // Get properties
    const [properties] = await db.query('SELECT * FROM Property WHERE owner_citizen_id = ?', [citizenId]);
    // Get service bookings
    const [bookings] = await db.query('SELECT * FROM Service_Booking WHERE citizen_id = ?', [citizenId]);
    // Get complaints
    const [complaints] = await db.query('SELECT * FROM Complaints WHERE citizen_id = ?', [citizenId]);
    res.json({
      citizen: citizens[0],
      vehicles,
      properties,
      bookings,
      complaints
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Get citizen by user_id (linked_id in Users table)
router.get('/by-user/:user_id', async (req, res) => {
  const userId = req.params.user_id;
  try {
    // Find the user and get their linked_id
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [userId]);
    if (!users.length || !users[0].linked_id) {
      return res.status(404).json({ error: 'Citizen not found for this user' });
    }
    const linkedId = users[0].linked_id;
    // Get the citizen record
    const [citizens] = await db.query('SELECT * FROM Citizen WHERE citizen_id = ?', [linkedId]);
    if (!citizens.length) {
      return res.status(404).json({ error: 'Citizen not found' });
    }
    res.json(citizens[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk insert citizens (admin only)
router.post("/bulk", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  const citizens = req.body.citizens;
  if (!Array.isArray(citizens) || citizens.length === 0) {
    return res.status(400).json({ error: "citizens array required" });
  }
  const values = citizens.map(c => [
    c.first_name, c.last_name, c.street, c.area, c.city, c.pincode, c.gender, c.dob, c.house_id
  ]);
  try {
    // Insert citizens and get their IDs
    const [result] = await db.query(
      `INSERT INTO Citizen (first_name, last_name, street, area, city, pincode, gender, dob, house_id)
      VALUES ?`,
      [values]
    );
    // Get the first inserted ID
    const firstId = result.insertId;
    // Prepare user accounts and emails
    const users = [];
    const emails = [];
    for (let i = 0; i < citizens.length; i++) {
      const citizen = citizens[i];
      const email = citizen.email; // must be provided in input
      if (!email) continue;
      const password = crypto.randomBytes(6).toString('base64');
      const password_hash = await bcrypt.hash(password, 10);
      const citizen_id = firstId + i;
      users.push([email, password_hash, 'citizen', citizen_id]);
      emails.push({ email, password });
    }
    if (users.length > 0) {
      await db.query(
        `INSERT INTO Users (email, password_hash, role, linked_id) VALUES ?`,
        [users]
      );
      // Send emails with credentials
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER || 'your_gmail@gmail.com',
          pass: process.env.SMTP_PASS || 'your_gmail_app_password',
        },
      });
      for (const e of emails) {
        await transporter.sendMail({
          from: process.env.SMTP_USER || 'your_gmail@gmail.com',
          to: e.email,
          subject: 'Your Smart City Account Credentials',
          text: `Welcome!\nEmail: ${e.email}\nPassword: ${e.password}`,
        });
      }
    }
    res.json({ message: "Bulk citizens added and user accounts created", count: citizens.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Search citizens by name or ID (admin only)
router.get("/search", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing search query" });
  const sql = `SELECT * FROM Citizen WHERE first_name LIKE ? OR last_name LIKE ? OR citizen_id = ?`;
  const likeQ = `%${q}%`;
  try {
    const [rows] = await db.query(sql, [likeQ, likeQ, q]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all citizens (admin only)
// Pagination, filtering, and sorting for citizens
router.get("/", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  const { city, area, page = 1, limit = 10, sort_by = "citizen_id", order = "asc" } = req.query;
  let sql = "SELECT * FROM Citizen";
  const params = [];
  const conditions = [];
  if (city) {
    conditions.push("city = ?");
    params.push(city);
  }
  if (area) {
    conditions.push("area = ?");
    params.push(area);
  }
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  // Sorting
  sql += ` ORDER BY ${sort_by} ${order.toUpperCase() === "DESC" ? "DESC" : "ASC"}`;
  // Pagination
  sql += " LIMIT ? OFFSET ?";
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hard delete citizen (admin only)
router.delete("/:citizen_id", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    await db.query("DELETE FROM Citizen WHERE citizen_id = ?", [req.params.citizen_id]);
    res.json({ message: "Citizen deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new citizen
router.post("/", async (req, res) => {
  const {
    first_name,
    last_name,
    street,
    area,
    city,
    pincode,
    gender,
    dob,
    house_id
  } = req.body;
  try {
    await db.query(
      `INSERT INTO Citizen (first_name, last_name, street, area, city, pincode, gender, dob, house_id)
      VALUES ( ?, ?, ?, ?, ?, ?, ?, ?,?)`,
      [first_name, last_name, street, area, city, pincode, gender, dob, house_id]
    );
    if (req.user) {
      const { logAuditAction } = require("../db");
      logAuditAction(req.user.id, "create", "Citizen", JSON.stringify({ first_name, last_name }));
    }
    res.json({ message: "Citizen added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;