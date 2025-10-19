const express = require("express");
const db = require("../db");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// Get all complaints for the currently logged-in citizen
router.get("/my", authenticateToken, async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: "Authentication error: User ID not found." });

  try {
    // Resolve user's linked profile id (citizen_id)
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });
    const citizenId = users[0].linked_id;
    if (!citizenId) return res.status(400).json({ message: 'Profile incomplete. Please complete your profile before viewing your complaints.' });

    const [rows] = await db.query(
        "SELECT complaint_id, complaint_text, status, complaint_date FROM Complaints WHERE citizen_id = ? ORDER BY complaint_date DESC",
        [citizenId]
    );

    const complaints = rows.map(row => {
        const complaint_text = row.complaint_text || "";
        let category = 'N/A';
        let subject = 'N/A';

        const categoryMatch = complaint_text.match(/^Category: (.*)/m);
        if (categoryMatch && categoryMatch[1]) category = categoryMatch[1].split('\n')[0];

        const subjectMatch = complaint_text.match(/^Subject: (.*)/m);
        if (subjectMatch && subjectMatch[1]) subject = subjectMatch[1].split('\n')[0];

        if (subject === 'N/A' && category === 'N/A') {
            subject = complaint_text.substring(0, 50) + (complaint_text.length > 50 ? '...' : '');
        }


        return {
            tracking_id: row.complaint_id,
            category: category,
            subject: subject,
            created_at: row.complaint_date,
            status: row.status
        };
    });

    res.json(complaints);
  } catch (err) {
  console.error("Database error fetching user's complaints:", err);
  res.status(500).json({ message: "Failed to retrieve complaints due to a server error." });
  }
});

// Get all complaints for a specific citizen (user)
router.get("/user/:user_id", authenticateToken, async (req, res) => {
  const rawId = req.params.user_id;
  try {
    // Resolve Users.user_id -> linked_id if possible, else assume rawId is citizen_id
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [rawId]);
    const citizenId = (users.length && users[0].linked_id) ? users[0].linked_id : rawId;

    const [rows] = await db.query("SELECT complaint_id, complaint_text, status, complaint_date FROM Complaints WHERE citizen_id = ?", [citizenId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Analytics/statistics endpoint for complaints (admin and service_provider)
router.get("/stats", authenticateToken, authorizeRoles("admin", "service_provider"), async (req, res) => {
  try {
    const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM Complaints");
    const [statusCounts] = await db.query("SELECT status, COUNT(*) as count FROM Complaints GROUP BY status");
    res.json({ total, statusCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Search complaints by text or ID (admin and service_provider)
router.get("/search", authenticateToken, authorizeRoles("admin", "service_provider"), async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing search query" });
  const sql = `SELECT * FROM Complaints WHERE complaint_text LIKE ? OR complaint_id = ?`;
  const likeQ = `%${q}%`;
  try {
    const [rows] = await db.query(sql, [likeQ, q]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all complaints (admin and service_provider)
// Pagination, filtering, and sorting for complaints
router.get("/", authenticateToken, authorizeRoles("admin", "service_provider"), async (req, res) => {
  const { citizen_id, status, page = 1, limit = 10, sort_by = "complaint_date", order = "desc" } = req.query;
  let sql = "SELECT * FROM Complaints";
  const params = [];
  const conditions = [];
  if (citizen_id) {
    conditions.push("citizen_id = ?");
    params.push(citizen_id);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  // Sorting
  sql += ` ORDER BY ${sort_by} ${order.toUpperCase() === "ASC" ? "ASC" : "DESC"}`;
  // Pagination
  sql += " LIMIT ? OFFSET ?";
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  try {
    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update complaint status
router.put("/:complaint_id/status", async (req, res) => {
  const { status } = req.body;
  try {
    await db.query("UPDATE Complaints SET status = ? WHERE complaint_id = ?", [
      status,
      req.params.complaint_id,
    ]);
    res.json({ message: "Complaint status updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Add new complaint (supports structured fields, authenticated)
router.post("/", authenticateToken, async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Authentication required.' });

  // Resolve linked citizen profile id
  const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [userId]);
  if (users.length === 0) return res.status(404).json({ message: 'User not found.' });
  const citizen_id = users[0].linked_id;
  if (!citizen_id) return res.status(400).json({ message: 'Complete your profile before submitting complaints.' });

  // Ensure the linked citizen profile actually exists (prevents foreign key errors)
  const [citizens] = await db.query('SELECT citizen_id FROM Citizen WHERE citizen_id = ?', [citizen_id]);
  if (citizens.length === 0) {
    console.error(`Linked citizen id ${citizen_id} for user ${userId} does not exist in Citizen table.`);
    return res.status(400).json({ message: 'Your account is linked to a missing profile. Please complete your profile or contact support.' });
  }

  const {
    subject,
    category,
    location,
    description
  } = req.body;

  // Server-side validation
  const allowedCategories = ['Public_Light','Water_Supply','Road_Condition','Waste_Management','Traffic_Signal','Other'];
  if (!subject || typeof subject !== 'string' || subject.trim().length < 5 || subject.trim().length > 100) return res.status(400).json({ message: 'Subject must be 5-100 characters.' });
  if (!category || !allowedCategories.includes(category)) return res.status(400).json({ message: 'Invalid category.' });
  if (!location || typeof location !== 'string' || location.trim().length < 5) return res.status(400).json({ message: 'Location is required (min 5 chars).' });
  if (!description || typeof description !== 'string' || description.trim().length < 10) return res.status(400).json({ message: 'Description must be at least 10 characters.' });

    const complaint_text = `Category: ${category}\nSubject: ${subject}\nLocation: ${location}\nDescription: ${description}`;
    const status = 'New';

    const sql = `
        INSERT INTO Complaints (citizen_id, complaint_text, status)
        VALUES (?, ?, ?)
    `;
    const values = [citizen_id, complaint_text, status];

  try {
    const [result] = await db.query(sql, values);
    res.status(201).json({
      message: 'Complaint submitted successfully.',
      trackingId: result.insertId,
      id: result.insertId
    });
  } catch (error) {
    console.error('Database error on complaint submission:', error);
    // If insertion failed due to foreign key or other constraint, return a helpful message
    res.status(500).json({ message: 'Failed to submit complaint due to a server error.' });
  }
});

module.exports = router;