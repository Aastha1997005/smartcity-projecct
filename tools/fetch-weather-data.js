require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const { db } = require('../db');

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const LOCATION = 'London'; // You can make this configurable

const WEATHER_SENSOR_ID = 1001;
const AQI_SENSOR_ID = 1002;

async function setupSensors() {
  try {
    // Create infrastructure assets first
    await db.query('INSERT IGNORE INTO Infrastructure (asset_id, zone_id) VALUES (?, ?)', [WEATHER_SENSOR_ID, 1]);
    await db.query('INSERT IGNORE INTO Infrastructure (asset_id, zone_id) VALUES (?, ?)', [AQI_SENSOR_ID, 1]);
      
    // Create main sensor entries
    await db.query('INSERT IGNORE INTO Sensors (sensor_id, status, location) VALUES (?, ?, ?)', [WEATHER_SENSOR_ID, 'Active', LOCATION]);
    await db.query('INSERT IGNORE INTO Sensors (sensor_id, status, location) VALUES (?, ?, ?)', [AQI_SENSOR_ID, 'Active', LOCATION]);

    // Create specific sensor type entries
    await db.query('INSERT IGNORE INTO Weather_Sensors (sensor_id) VALUES (?)', [WEATHER_SENSOR_ID]);
    await db.query('INSERT IGNORE INTO Air_Quality_Sensors (sensor_id) VALUES (?)', [AQI_SENSOR_ID]);

    console.log('Sensors setup complete.');
  } catch (error) {
    console.error('Error setting up sensors:', error);
  }
}

async function fetchAndStoreData() {
  try {
    await setupSensors();

    const url = `http://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${LOCATION}&aqi=yes`;
    const response = await axios.get(url);
    const data = response.data;

    // Insert weather data
    const weather = data.current;
    const weatherQuery = `
      INSERT INTO Weather_Reading (sensor_id, time_stamp, wind_speed, pressure, temperature, rainfall, humidity)
      VALUES (?, NOW(), ?, ?, ?, ?, ?)
    `;
    await db.query(weatherQuery, [WEATHER_SENSOR_ID, weather.wind_kph, weather.pressure_mb, weather.temp_c, weather.precip_mm, weather.humidity]);
    console.log('Weather data inserted.');

    // Insert air quality data
    const aqi = data.current.air_quality;
    const aqiQuery = `
      INSERT INTO AQ_Reading (sensor_id, timestamp, PM2_5, PM10, CO2_level, aqindex, NO2_level)
      VALUES (?, NOW(), ?, ?, ?, ?, ?)
    `;
    await db.query(aqiQuery, [AQI_SENSOR_ID, aqi.pm2_5, aqi.pm10, aqi.co, aqi['gb-defra-index'], aqi.no2]);
    console.log('Air quality data inserted.');

  } catch (error) {
    console.error('Error fetching and storing data:', error.response ? error.response.data : error.message);
  } finally {
    db.end();
  }
}

fetchAndStoreData();
