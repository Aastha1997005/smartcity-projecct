const express = require("express");
const router = express.Router();
const db = require("../db");


// Get all vehicles for a specific citizen (user)
router.get("/user/:user_id", async (req, res) => {
  const rawId = req.params.user_id;
  try {
    // Try to resolve as a Users.user_id -> linked_id first
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [rawId]);
    let citizenId = null;
    if (users.length && users[0].linked_id) {
      citizenId = users[0].linked_id;
    } else {
      // Fall back: assume caller passed a citizen_id already
      citizenId = rawId;
    }

    const [rows] = await db.query(
      `SELECT v.*, f.type AS fuel_type
       FROM Vehicle v
       LEFT JOIN Fuel f ON v.consumes_fuel_id = f.fuel_id
       WHERE v.owner_citizen_id = ?`,
      [citizenId]
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
    // Server-side validation
    const vehicleNoRegex = /^[A-Z]{2,3}-?\d{1,4}-?[A-Z]{0,3}$/i; // simple flexible pattern
    if (!vehicle_no || !vehicleNoRegex.test(vehicle_no)) return res.status(400).json({ error: 'Invalid vehicle number format' });
    if (!type || typeof type !== 'string' || type.length > 30) return res.status(400).json({ error: 'Invalid vehicle type' });
    if (!model || typeof model !== 'string' || model.length > 50) return res.status(400).json({ error: 'Invalid model' });
    // Ensure owner exists
    const [owners] = await db.query('SELECT citizen_id FROM Citizen WHERE citizen_id = ?', [owner_citizen_id]);
    if (owners.length === 0) return res.status(400).json({ error: 'Owner (citizen) not found' });
    // If fuel id provided, check existence
    if (consumes_fuel_id) {
      const [fuels] = await db.query('SELECT fuel_id FROM Fuel WHERE fuel_id = ?', [consumes_fuel_id]);
      if (fuels.length === 0) return res.status(400).json({ error: 'Invalid fuel id' });
    }
    // Check uniqueness of vehicle_no
    const [existing] = await db.query('SELECT vehicle_no FROM Vehicle WHERE vehicle_no = ?', [vehicle_no]);
    if (existing.length > 0) return res.status(409).json({ error: 'Vehicle number already registered' });

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