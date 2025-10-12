const express = require("express");
const db = require("../db");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

// Get all complaints for a specific citizen (user)
router.get("/user/:user_id", authenticateToken, async (req, res) => {
  const userId = req.params.user_id;
  try {
    const [rows] = await db.query("SELECT * FROM Complaints WHERE citizen_id = ?", [userId]);
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
  const { citizen_id, status, page = 1, limit = 10, sort_by = "created_at", order = "desc" } = req.query;
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
// Add new complaint (supports all columns)
router.post("/", async (req, res) => {
  const {
    citizen_id,
    service_id = null,
    utility_id = null,
    healthcare_id = null,
    transport_id = null,
    complaint_text,
  } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO Complaints (citizen_id, service_id, utility_id, healthcare_id, transport_id, complaint_text)
     VALUES (?, ?, ?, ?, ?, ?)`,
      [
        citizen_id,
        service_id,
        utility_id,
        healthcare_id,
        transport_id,
        complaint_text,
      ]
    );
    res.json({ message: "✅ Complaint submitted", id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;