const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Create a maintenance task (department users)
router.post('/tasks', authenticateToken, async (req, res) => {
  const userId = req.user && req.user.id;
  const { title, description, department, priority, asset_id, scheduled_at } = req.body;
  try {
    // Insert into the project's `Maintenance_Task` table (singular) matching provided schema.
    const [result] = await db.query(
      `INSERT INTO Maintenance_Task (asset_id, task_type, description, scheduled_date, completion_date, status, assigned_to, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [asset_id || null, title || 'general', description || null, scheduled_at || null, null, 'Scheduled', null, priority || 'medium', userId || null]
    );
    res.status(201).json({ message: 'Task created', task_id: result.insertId });
  } catch (err) {
    console.error('Maintenance task create error:', err);
    res.status(500).json({ error: 'Failed to create maintenance task' });
  }
});

// List tasks for a department
router.get('/tasks/:department', authenticateToken, async (req, res) => {
  const dept = req.params.department;
  try {
    const [rows] = await db.query('SELECT * FROM Maintenance_Tasks WHERE department = ? ORDER BY created_at DESC', [dept]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

