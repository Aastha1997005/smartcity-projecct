const express = require('express');
const router = express.Router();
const db = require('../db');

// Quick debug logger for incoming requests to this router
router.use((req, res, next) => {
  console.log('[sensors router] incoming', req.method, req.path);
  next();
});

// Simple in-code rules for auto-creating alerts/tasks
const RULES = [
  { metric: 'light_status', op: '==', value: 'FAULT', department: 'public_lights', task_type: 'repair', priority: 'high' },
  { metric: 'energy', op: '>', value: 1000, department: 'electricity', task_type: 'inspect_energy', priority: 'medium' }
];

// Ingestion requires a header: x-sensor-api-key. Default key: process.env.SENSOR_API_KEY || 'dev-sensor-key'
router.post('/data', async (req, res) => {
  const apiKey = req.header('x-sensor-api-key') || '';
  const expected = process.env.SENSOR_API_KEY || 'dev-sensor-key';
  if (apiKey !== expected) return res.status(401).json({ error: 'invalid api key' });
  const { sensor_id, metric, value, unit, recorded_at } = req.body;
  if (!sensor_id || !metric) return res.status(400).json({ error: 'sensor_id and metric required' });
  try {
    // Insert telemetry
    // Store numeric readings in `value`; non-numeric readings (e.g. 'FAULT') are stored as NULL.
    const num = Number(value);
    const dbValue = Number.isNaN(num) ? null : num;
    await db.query(
      `INSERT INTO Sensor_Data (sensor_id, metric, value, unit, recorded_at) VALUES (?, ?, ?, ?, ?)`,
      [sensor_id, metric, dbValue, unit || null, recorded_at || new Date()]
    );

    // Evaluate rules
    for (const rule of RULES) {
      if (rule.metric !== metric) continue;
      let triggered = false;
      const valNum = Number(value);
      switch (rule.op) {
        case '==': triggered = String(value) === String(rule.value); break;
        case '>': triggered = valNum > Number(rule.value); break;
        case '<': triggered = valNum < Number(rule.value); break;
      }
      if (!triggered) continue;

      // Resolve asset_id for sensor
      const [[srow]] = await db.query('SELECT asset_id FROM Sensors WHERE sensor_id = ?', [sensor_id]);
      const asset_id = srow ? srow.asset_id : null;

      // Create alert. `Alerts` table does not include sensor_id column in your schema,
      // so embed sensor_id inside the JSON `details` column.
      await db.query('INSERT INTO Alerts (asset_id, alert_type, severity, details) VALUES (?, ?, ?, ?)',
        [asset_id, rule.task_type, 'warning', JSON.stringify({ metric, value, sensor_id })]);

      // Avoid duplicate open tasks in last 6 hours
      const [existing] = await db.query(
        `SELECT task_id FROM Maintenance_Task WHERE asset_id = ? AND task_type = ? AND status IN ('Scheduled','In Progress') AND created_at > DATE_SUB(NOW(), INTERVAL 6 HOUR) LIMIT 1`,
        [asset_id, rule.task_type]
      );
      if (!existing || existing.length === 0) {
        await db.query(
          `INSERT INTO Maintenance_Task (asset_id, task_type, description, scheduled_date, completion_date, status, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [asset_id, rule.task_type, `Auto task from sensor ${metric}=${value}`, null, null, 'Scheduled', null]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('sensors/data error', err);
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
