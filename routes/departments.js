const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// List departments (public)
router.get('/', async (req, res) => {
  try {
    // Simple static list for now
    const departments = [
      'transport', 'waste_management', 'public_lights', 'water', 'electricity', 'internet'
    ];
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get department details (admin or department user)
router.get('/:dept', authenticateToken, async (req, res) => {
  const dept = req.params.dept;
  try {
    // TODO: return department metadata, contact points, dashboards links
    res.json({ department: dept, description: `Operations for ${dept}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List services provided by a department (frontend pages will call this)
router.get('/:dept/services', async (req, res) => {
  const dept = req.params.dept;
  // Static service lists for now; we can later move this to DB Service table with mapping
  const mapping = {
    transport: ['Route info', 'Bus timings', 'New route request'],
    waste_management: ['Garbage pickup', 'Bulk waste pickup', 'Street cleaning'],
    public_lights: ['Report outage', 'Request new light', 'Brightness issues'],
    water: ['Water supply complaint', 'Leak reporting', 'New connection'],
    electricity: ['Power outage', 'Meter issue', 'New connection'],
    internet: ['Connectivity complaint', 'New broadband request']
  };
  res.json({ department: dept, services: mapping[dept] || [] });
});

// Submit an internal request to a department (creates a Maintenance_Task)
router.post('/:dept/request', authenticateToken, async (req, res) => {
  const dept = req.params.dept;
  const userId = req.user && req.user.id;
  const { task_type, description, asset_id, priority, scheduled_date } = req.body;
  try {
    // Use department name as default task_type if none provided
    const tt = task_type || dept;
    const [result] = await db.query(
      `INSERT INTO Maintenance_Task (asset_id, task_type, description, scheduled_date, completion_date, status, assigned_to, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [asset_id || null, tt, description || null, scheduled_date || null, null, 'Scheduled', null, priority || 'medium', userId || null]
    );
    res.status(201).json({ message: 'Request created', task_id: result.insertId });
  } catch (err) {
    console.error('dept request error', err);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// List tasks for a department (task_type equal or prefixed by dept)
router.get('/:dept/tasks', authenticateToken, async (req, res) => {
  const dept = req.params.dept;
  try {
    const [rows] = await db.query(
      `SELECT * FROM Maintenance_Task WHERE task_type = ? OR task_type LIKE CONCAT(?, '%') ORDER BY created_at DESC LIMIT 200`,
      [dept, dept]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List recent alerts (best-effort; Alerts.details may contain sensor info)
router.get('/:dept/alerts', authenticateToken, async (req, res) => {
  const dept = req.params.dept;
  try {
    // We don't have a department column on Alerts; return recent alerts and let frontend filter if needed.
    const [rows] = await db.query('SELECT * FROM Alerts ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
