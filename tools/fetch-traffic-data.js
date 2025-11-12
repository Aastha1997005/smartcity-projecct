require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const { db } = require('../db');

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;
const LATITUDE = 51.5074;
const LONGITUDE = -0.1278;

const TRAFFIC_SENSOR_ID = 1003;

async function setupSensor() {
  try {
    // Create infrastructure asset first
    await db.query('INSERT IGNORE INTO Infrastructure (asset_id, zone_id) VALUES (?, ?)', [TRAFFIC_SENSOR_ID, 1]);
      
    // Create main sensor entry
    await db.query('INSERT IGNORE INTO Sensors (sensor_id, status, location) VALUES (?, ?, ?)', [TRAFFIC_SENSOR_ID, 'Active', 'London A2']);

    // Create specific sensor type entry
    await db.query('INSERT IGNORE INTO Traffic_Sensors (sensor_id) VALUES (?)', [TRAFFIC_SENSOR_ID]);

    console.log('Traffic sensor setup complete.');
  } catch (error) {
    console.error('Error setting up traffic sensor:', error);
  }
}

async function fetchAndStoreData() {
  try {
    await setupSensor();

    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${LATITUDE},${LONGITUDE}&key=${TOMTOM_API_KEY}`;
    const response = await axios.get(url);
    const data = response.data.flowSegmentData;

    const avg_speed = data.currentSpeed;
    const congestion_level = data.confidence;
    const vehicle_count = data.currentTravelTime; // Using currentTravelTime as a proxy for vehicle count

    const query = `
      INSERT INTO Traffic_Sensor_Reading (sensor_id, time_stamp, avg_speed, congestion_level, vehicle_count)
      VALUES (?, NOW(), ?, ?, ?)
    `;
    await db.query(query, [TRAFFIC_SENSOR_ID, avg_speed, congestion_level, vehicle_count]);
    console.log('Traffic data inserted.');

  } catch (error) {
    console.error('Error fetching and storing traffic data:', error.response ? error.response.data : error.message);
  } finally {
    db.end();
  }
}

fetchAndStoreData();
