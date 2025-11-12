const express = require("express");
const router = express.Router();
const {db} = require("../db");
const Joi = require('joi');

// Get the latest air quality reading from any sensor
router.get("/latest", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM AQ_Reading ORDER BY timestamp DESC LIMIT 1"
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "No air quality readings found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const createAirQualitySensorReadingSchema = Joi.object({
  timestamp: Joi.date().required(),
  PM2_5: Joi.number().required(),
  PM10: Joi.number().required(),
  CO2_level: Joi.number().required(),
  aqindex: Joi.number().integer().required(),
  NO2_level: Joi.number().required()
});

// Get all air quality sensors
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Air_Quality_Sensors");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get air quality sensor by ID
router.get("/:sensor_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Air_Quality_Sensors WHERE sensor_id = ?",
      [req.params.sensor_id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Air quality sensor not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new air quality sensor
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
    await db.query("INSERT INTO Air_Quality_Sensors (sensor_id) VALUES (?)", [
      sensor_id,
    ]);
    res.json({ message: "Air quality sensor created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all readings for an air quality sensor, with optional date filter
router.get("/:sensor_id/readings", async (req, res) => {
  const { from, to } = req.query;
  let sql = "SELECT * FROM AQ_Reading WHERE sensor_id = ?";
  const params = [req.params.sensor_id];
  if (from) {
    sql += " AND timestamp >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND timestamp <= ?";
    params.push(to);
  }
  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new air quality sensor reading
router.post("/:sensor_id/readings", async (req, res) => {
  const { error, value } = createAirQualitySensorReadingSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const { timestamp, PM2_5, PM10, CO2_level, aqindex, NO2_level } = value;
  try {
    await db.query(
      "INSERT INTO AQ_Reading (sensor_id, timestamp, PM2_5, PM10, CO2_level, aqindex, NO2_level) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        req.params.sensor_id,
        timestamp,
        PM2_5,
        PM10,
        CO2_level,
        aqindex,
        NO2_level,
      ]
    );
    res.json({ message: "Air quality sensor reading added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
