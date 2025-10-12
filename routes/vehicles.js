const express = require("express");
const router = express.Router();
const db = require("../db");


// Get all vehicles for a specific citizen (user)
router.get("/user/:user_id", async (req, res) => {
  const userId = req.params.user_id;
  try {
    const [rows] = await db.query(
      `SELECT v.*, f.type AS fuel_type
       FROM Vehicle v
       LEFT JOIN Fuel f ON v.consumes_fuel_id = f.fuel_id
       WHERE v.owner_citizen_id = ?`,
      [userId]
    );
    // Add is_expiring mock property for demo (replace with real logic if needed)
    rows.forEach(v => v.is_expiring = false);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all vehicles
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT v.vehicle_no, v.type, v.model,
        CONCAT(c.first_name, ' ', c.last_name) AS owner_name,
        f.type AS fuel_type
      FROM Vehicle v
      LEFT JOIN Citizen c ON v.owner_citizen_id = c.citizen_id
      LEFT JOIN Fuel f ON v.consumes_fuel_id = f.fuel_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a vehicle
router.post("/", async (req, res) => {
  const { vehicle_no, type, model, owner_citizen_id, consumes_fuel_id } = req.body;
  try {
    await db.query(
      "INSERT INTO Vehicle (vehicle_no, type, model, owner_citizen_id, consumes_fuel_id) VALUES (?, ?, ?, ?, ?)",
      [vehicle_no, type, model, owner_citizen_id, consumes_fuel_id]
    );
    res.json({ message: "Vehicle registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one vehicle by number
router.get("/:vehicle_no", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.vehicle_no, v.type, v.model,
        CONCAT(c.first_name, ' ', c.last_name) AS owner_name,
        f.type AS fuel_type
       FROM Vehicle v
       LEFT JOIN Citizen c ON v.owner_citizen_id = c.citizen_id
       LEFT JOIN Fuel f ON v.consumes_fuel_id = f.fuel_id
       WHERE v.vehicle_no = ?`,
      [req.params.vehicle_no]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Vehicle not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;