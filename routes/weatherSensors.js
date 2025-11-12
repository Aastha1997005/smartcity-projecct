const express = require("express");
const router = express.Router();
const {db} = require("../db");
const Joi = require('joi');

const createWeatherSensorReadingSchema = Joi.object({
  time_stamp: Joi.date().required(),
  wind_speed: Joi.number().required(),
  pressure: Joi.number().required(),
  temperature: Joi.number().required(),
  rainfall: Joi.number().required(),
  humidity: Joi.number().required()
});

// Get all weather sensors
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Weather_Sensors");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get weather sensor by ID
router.get("/:sensor_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Weather_Sensors WHERE sensor_id = ?",
      [req.params.sensor_id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Weather sensor not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new weather sensor
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
    await db.query("INSERT INTO Weather_Sensors (sensor_id) VALUES (?)", [
      sensor_id,
    ]);
    res.json({ message: "Weather sensor created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all readings for a weather sensor, with optional date filter
router.get("/:sensor_id/readings", async (req, res) => {
  const { from, to } = req.query;
  let sql = "SELECT * FROM Weather_Reading WHERE sensor_id = ?";
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

// Add a new weather sensor reading
router.post("/:sensor_id/readings", async (req, res) => {
  const { error, value } = createWeatherSensorReadingSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const { time_stamp, wind_speed, pressure, temperature, rainfall, humidity } = value;
  try {
    await db.query(
      "INSERT INTO Weather_Reading (sensor_id, time_stamp, wind_speed, pressure, temperature, rainfall, humidity) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        req.params.sensor_id,
        time_stamp,
        wind_speed,
        pressure,
        temperature,
        rainfall,
        humidity,
      ]
    );
    res.json({ message: "Weather sensor reading added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;