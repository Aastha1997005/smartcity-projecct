const express = require('express');
const router = express.Router();
const {db} = require('../db');

// Get all readings for a traffic sensor, with optional date filter
router.get('/traffic_sensors/:sensor_id/readings', async (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM Traffic_Sensor_Reading WHERE sensor_id = ?';
  const params = [req.params.sensor_id];
  if (from) {
    sql += ' AND time_stamp >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND time_stamp <= ?';
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
router.post('/traffic_sensors/:sensor_id/readings', async (req, res) => {
  const { time_stamp, avg_speed, congestion_level, vehicle_count } = req.body;
  try {
    await db.query(
      'INSERT INTO Traffic_Sensor_Reading (sensor_id, time_stamp, avg_speed, congestion_level, vehicle_count) VALUES (?, ?, ?, ?, ?)',
      [req.params.sensor_id, time_stamp, avg_speed, congestion_level, vehicle_count]
    );
    res.json({ message: 'Traffic sensor reading added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all readings for an air quality sensor, with optional date filter
router.get('/air_quality_sensors/:sensor_id/readings', async (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM AQ_Reading WHERE sensor_id = ?';
  const params = [req.params.sensor_id];
  if (from) {
    sql += ' AND timestamp >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND timestamp <= ?';
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
router.post('/air_quality_sensors/:sensor_id/readings', async (req, res) => {
  const { timestamp, PM2_5, PM10, CO2_level, aqindex, NO2_level } = req.body;
  try {
    await db.query(
      'INSERT INTO AQ_Reading (sensor_id, timestamp, PM2_5, PM10, CO2_level, aqindex, NO2_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.sensor_id, timestamp, PM2_5, PM10, CO2_level, aqindex, NO2_level]
    );
    res.json({ message: 'Air quality sensor reading added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all readings for a weather sensor, with optional date filter
router.get('/weather_sensors/:sensor_id/readings', async (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM Weather_Reading WHERE sensor_id = ?';
  const params = [req.params.sensor_id];
  if (from) {
    sql += ' AND time_stamp >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND time_stamp <= ?';
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
router.post('/weather_sensors/:sensor_id/readings', async (req, res) => {
  const { time_stamp, wind_speed, pressure, temperature, rainfall, humidity } = req.body;
  try {
    await db.query(
      'INSERT INTO Weather_Reading (sensor_id, time_stamp, wind_speed, pressure, temperature, rainfall, humidity) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.sensor_id, time_stamp, wind_speed, pressure, temperature, rainfall, humidity]
    );
    res.json({ message: 'Weather sensor reading added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
