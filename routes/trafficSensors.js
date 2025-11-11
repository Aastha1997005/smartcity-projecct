const express = require("express");
const router = express.Router();
const {db} = require("../db");

// Get all traffic sensors
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Traffic_Sensors");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get traffic sensor by ID
router.get("/:sensor_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Traffic_Sensors WHERE sensor_id = ?",
      [req.params.sensor_id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Traffic sensor not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new traffic sensor
router.post("/", async (req, res) => {
  const {
    sensor_id,
    status,
    location,
    provider_id,
    data_frequency,
    last_calibrated,
    installation_date,
  } = req.body;
  try {
    await db.query(
      "INSERT INTO Sensors (sensor_id, status, location, provider_id, data_frequency, last_calibrated, installation_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        sensor_id,
        status,
        location,
        provider_id,
        data_frequency,
        last_calibrated,
        installation_date,
      ]
    );
    await db.query("INSERT INTO Traffic_Sensors (sensor_id) VALUES (?)", [sensor_id]);
    res.json({ message: "Traffic sensor created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all readings for a traffic sensor, with optional date filter
router.get("/:sensor_id/readings", async (req, res) => {
  const { from, to } = req.query;
  let sql = "SELECT * FROM Traffic_Sensor_Reading WHERE sensor_id = ?";
  const params = [req.params.sensor_id];
  if (from) {
    sql += " AND time_stamp >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND time_stamp <= ?";
    params.push(to);
  }
  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new traffic sensor reading
router.post("/:sensor_id/readings", async (req, res) => {
  const { time_stamp, avg_speed, congestion_level, vehicle_count } = req.body;
  try {
    await db.query(
      "INSERT INTO Traffic_Sensor_Reading (sensor_id, time_stamp, avg_speed, congestion_level, vehicle_count) VALUES (?, ?, ?, ?, ?)",
      [
        req.params.sensor_id,
        time_stamp,
        avg_speed,
        congestion_level,
        vehicle_count,
      ]
    );
    res.json({ message: "Traffic sensor reading added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;