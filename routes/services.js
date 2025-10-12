const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all service bookings for a specific user
router.get("/bookings/user/:user_id", async (req, res) => {
  const userId = req.params.user_id;
  try {
    const [rows] = await db.query(
      `SELECT * FROM Service_Booking WHERE citizen_id = ?`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Analytics/statistics endpoint for services
router.get("/usage", async (req, res) => {
  try {
    const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM Service");
    const [statusCounts] = await db.query("SELECT availability_status, COUNT(*) as count FROM Service GROUP BY availability_status");
    res.json({ total, statusCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Search services by name or ID
router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing search query" });
  const sql = `SELECT * FROM Service WHERE service_name LIKE ? OR service_id = ?`;
  const likeQ = `%${q}%`;
  try {
    const [rows] = await db.query(sql, [likeQ, q]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pagination, filtering, and sorting for services
router.get("/", async (req, res) => {
  const { availability_status, page = 1, limit = 10, sort_by = "service_id", order = "asc" } = req.query;
  let sql = "SELECT * FROM Service";
  const params = [];
  if (availability_status) {
    sql += " WHERE availability_status = ?";
    params.push(availability_status);
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

// Add a new service
router.post("/", async (req, res) => {
  const {
    service_name,
    cost,
    availability_status,
    operating_hours
  } = req.body;

  try {
    await db.query(
      `INSERT INTO Service (service_name, cost, availability_status, operating_hours)
      VALUES (?, ?, ?, ?)`,
      [service_name, cost, availability_status, operating_hours]
    );
    res.json({ message: "Service added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
