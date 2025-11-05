
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

  // Set house_id to null if not provided or empty
  const houseIdValue = house_id === '' || house_id === undefined ? null : house_id;
  try {
    const [result] = await db.query(
      `INSERT INTO Citizen (first_name, last_name, street, area, city, pincode, gender, dob, house_id)
      VALUES ( ?, ?, ?, ?, ?, ?, ?, ?,?)`,
      [first_name, last_name, street, area, city, pincode, gender, dob, houseIdValue]
    );

    const newCitizenId = result.insertId;

    // If email provided, create a Users account for this citizen.
    // Admin may optionally supply a password in req.body.password. If omitted, the server generates one and returns it in the response.
    let generatedPassword = null;
    let emailSent = false;
    let emailAddress = null;
    if (req.body.email) {
      try {
        const email = req.body.email;
        emailAddress = email;
        let password = req.body.password && String(req.body.password).trim();
        if (!password) {
          // generate a temporary password
          password = crypto.randomBytes(6).toString('base64');
          generatedPassword = password;
        }
        const password_hash = await bcrypt.hash(password, 10);
        await db.query(`INSERT INTO Users (email, password_hash, role, linked_id) VALUES (?, ?, ?, ?)`, [email, password_hash, 'citizen', newCitizenId]);

        // send credentials email (best-effort)
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.SMTP_USER || 'your_gmail@gmail.com',
              pass: process.env.SMTP_PASS || 'your_gmail_app_password',
            },
          });
          const info = await transporter.sendMail({
            from: process.env.SMTP_USER || 'your_gmail@gmail.com',
            to: email,
            subject: 'Your Smart City Account Credentials',
            text: `Welcome to SmartCity!\nEmail: ${email}\nPassword: ${password}`,
          });
          // nodemailer returns an info object when successful
          if (info && (info.accepted && info.accepted.length > 0 || info.messageId)) {
            emailSent = true;
          }
        } catch (emailErr) {
          console.error('Failed to send citizen credentials email:', emailErr);
          // don't fail the whole request if email sending fails
        }
      } catch (userErr) {
        console.error('Failed to create user account for new citizen:', userErr);
        // continue; citizen was created
      }
    }

    if (req.user) {
      const { logAuditAction } = require("../db");
      logAuditAction(req.user.id, "create", "Citizen", JSON.stringify({ first_name, last_name }));
    }
    const responseBody = { message: "Citizen added", citizen_id: newCitizenId };
    if (generatedPassword) responseBody.generated_password = generatedPassword;
    if (emailAddress) {
      responseBody.email = emailAddress;
      responseBody.email_sent = !!emailSent;
    }
    res.json(responseBody);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// List bookings for a citizen (only the citizen themselves or admin)
router.get('/:citizen_id/bookings', authenticateToken, async (req, res) => {
  const citizenId = req.params.citizen_id;
  const requesterId = req.user && req.user.id;
  try {
    // verify requester is the same citizen (via Users.linked_id) or admin
    const [[reqUser]] = await db.query('SELECT role, linked_id FROM Users WHERE user_id = ?', [requesterId]);
    if (!reqUser) return res.status(404).json({ error: 'Requesting user not found' });
    if (reqUser.role !== 'admin' && String(reqUser.linked_id) !== String(citizenId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [rows] = await db.query(
      `SELECT b.*, s.service_name, s.cost, s.availability_status, b.service_name_cache, b.service_category_cache, b.provider_id
       FROM Service_Booking b
       LEFT JOIN Service s ON b.service_id = s.service_id
       WHERE b.citizen_id = ?
       ORDER BY b.booking_start DESC`,
      [citizenId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Citizen bookings list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a booking for a citizen (only the citizen themselves or admin)
router.post('/:citizen_id/bookings', authenticateToken, async (req, res) => {
  const citizenId = req.params.citizen_id;
  const requesterId = req.user && req.user.id;
  try {
    // verify requester
    const [[reqUser]] = await db.query('SELECT role, linked_id FROM Users WHERE user_id = ?', [requesterId]);
    if (!reqUser) return res.status(404).json({ error: 'Requesting user not found' });
    if (reqUser.role !== 'admin' && String(reqUser.linked_id) !== String(citizenId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let { service_id, booking_start, booking_end, details, priority } = req.body;
    if (!service_id || !booking_start) return res.status(400).json({ error: 'Missing required fields' });
    if (!booking_end) booking_end = booking_start;

    // Overlap check: prevent overlapping bookings for the same citizen
    const overlapSql = `SELECT COUNT(*) AS cnt FROM Service_Booking WHERE citizen_id = ? AND status IN ('upcoming','scheduled','in_progress')
      AND NOT (booking_end <= ? OR booking_start >= ?)`;
    const [ov] = await db.query(overlapSql, [citizenId, booking_start, booking_end]);
    if (ov && ov.length && ov[0].cnt > 0) return res.status(409).json({ error: 'Overlapping booking exists for this citizen' });

    // Overlap check for the service itself
    const overlapServiceSql = `SELECT COUNT(*) AS cnt FROM Service_Booking WHERE service_id = ? AND status IN ('upcoming','scheduled','in_progress')
      AND NOT (booking_end <= ? OR booking_start >= ?)`;
    const [ovSvc] = await db.query(overlapServiceSql, [service_id, booking_start, booking_end]);
    if (ovSvc && ovSvc.length && ovSvc[0].cnt > 0) return res.status(409).json({ error: 'Service is already booked for the requested time slot' });

    const [result] = await db.query(
      'INSERT INTO Service_Booking (citizen_id, service_id, booking_start, booking_end, details, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [citizenId, service_id, booking_start, booking_end || null, JSON.stringify(details || {}), priority || 'medium', requesterId || null]
    );
    const bookingId = result.insertId;

    // Autofill caches: service_name_cache, provider_id, service_category_cache
    const [[serviceRow]] = await db.query('SELECT service_name, provider_id FROM Service WHERE service_id = ? LIMIT 1', [service_id]);
    const svcName = serviceRow ? serviceRow.service_name : null;

    // Try explicit mapping -> provider
    let providerId = null;
    try {
      const [provRows] = await db.query('SELECT stp.provider_id FROM Service_To_Provider stp WHERE stp.service_id = ? LIMIT 1', [service_id]);
      if (provRows && provRows.length) providerId = provRows[0].provider_id;
    } catch (e) {
      // ignore if table missing
    }
    if (!providerId && serviceRow && serviceRow.provider_id) providerId = serviceRow.provider_id;

    // Category via mapping table
    let category = null;
    try {
      const [catRows] = await db.query(
        `SELECT sc.name FROM Service_Category_Map scm JOIN Service_Category sc ON scm.category_id = sc.category_id WHERE scm.service_id = ? LIMIT 1`,
        [service_id]
      );
      if (catRows && catRows.length) category = catRows[0].name;
    } catch (e) {
      // ignore
    }

    await db.query('UPDATE Service_Booking SET provider_id = ?, service_name_cache = ?, service_category_cache = ? WHERE booking_id = ?', [providerId, svcName, category, bookingId]);

    res.json({ booking_id: bookingId });
  } catch (err) {
    console.error('Citizen booking create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;