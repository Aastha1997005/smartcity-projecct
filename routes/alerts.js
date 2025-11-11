const express = require('express');
const router = express.Router();
const {db} = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * ALERTS ROUTES
 * Manages system alerts for infrastructure issues, sensor anomalies, etc.
 */

// Get all alerts with filtering
router.get('/', authenticateToken, authorizeRoles('admin', 'utility', 'transport', 'healthcare'), async (req, res) => {
  try {
    const { severity, acknowledged, asset_id, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT a.*, i.zone_id, z.zone_name
      FROM Alerts a
      LEFT JOIN Infrastructure i ON a.asset_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE 1=1
    `;
    const params = [];
    
    if (severity) {
      sql += ' AND a.severity = ?';
      params.push(severity);
    }
    if (acknowledged !== undefined) {
      sql += ' AND a.acknowledged = ?';
      params.push(acknowledged === 'true' ? 1 : 0);
    }
    if (asset_id) {
      sql += ' AND a.asset_id = ?';
      params.push(asset_id);
    }
    
    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [alerts] = await db.query(sql, params);
    
    const [summary] = await db.query(`
      SELECT severity, COUNT(*) as count
      FROM Alerts
      WHERE acknowledged = 0
      GROUP BY severity
    `);
    
    res.json({ alerts, summary });
  } catch (err) {
    console.error('Alerts list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get alerts by asset
router.get('/asset/:asset_id', authenticateToken, async (req, res) => {
  try {
    const [alerts] = await db.query(
      'SELECT * FROM Alerts WHERE asset_id = ? ORDER BY created_at DESC',
      [req.params.asset_id]
    );
    res.json(alerts);
  } catch (err) {
    console.error('Asset alerts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get active alerts summary
router.get('/summary/active', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  try {
    const [summary] = await db.query(`
      SELECT 
        severity,
        COUNT(*) as count,
        MAX(created_at) as latest_alert
      FROM Alerts
      WHERE acknowledged = 0
      GROUP BY severity
    `);
    
    const [[total]] = await db.query(
      'SELECT COUNT(*) as total FROM Alerts WHERE acknowledged = 0'
    );
    
    res.json({ summary, total: total.total });
  } catch (err) {
    console.error('Alert summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get alert by ID
router.get('/:alert_id', authenticateToken, async (req, res) => {
  try {
    const alertId = req.params.alert_id;
    // ensure numeric id to avoid catching other named routes
    if (isNaN(parseInt(alertId))) return res.status(400).json({ error: 'Invalid alert id' });

    const [[alert]] = await db.query(`
      SELECT a.*, i.zone_id, z.zone_name
      FROM Alerts a
      LEFT JOIN Infrastructure i ON a.asset_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE a.alert_id = ?
    `, [alertId]);
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (err) {
    console.error('Alert detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new alert
router.post('/', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  const { asset_id, alert_type, severity, details } = req.body;
  
  if (!alert_type || !severity) {
    return res.status(400).json({ error: 'alert_type and severity are required' });
  }
  
  const validSeverities = ['info', 'warning', 'critical'];
  if (!validSeverities.includes(severity)) {
    return res.status(400).json({ error: 'Invalid severity level' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO Alerts (asset_id, alert_type, severity, details) VALUES (?, ?, ?, ?)',
      [asset_id, alert_type, severity, JSON.stringify(details || {})]
    );
    
    res.json({ message: 'Alert created successfully', alert_id: result.insertId });
  } catch (err) {
    console.error('Alert creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Acknowledge alert
router.put('/:alert_id/acknowledge', authenticateToken, authorizeRoles('admin', 'utility', 'transport'), async (req, res) => {
  try {
    await db.query(
      'UPDATE Alerts SET acknowledged = 1 WHERE alert_id = ?',
      [req.params.alert_id]
    );
    
    res.json({ message: 'Alert acknowledged successfully' });
  } catch (err) {
    console.error('Alert acknowledge error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Resolve alert
router.put('/:alert_id/resolve', authenticateToken, authorizeRoles('admin', 'utility', 'transport'), async (req, res) => {
  try {
    await db.query(
      'UPDATE Alerts SET acknowledged = 1, resolved_at = NOW() WHERE alert_id = ?',
      [req.params.alert_id]
    );
    
    res.json({ message: 'Alert resolved successfully' });
  } catch (err) {
    console.error('Alert resolve error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete alert
router.delete('/:alert_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM Alerts WHERE alert_id = ?', [req.params.alert_id]);
    res.json({ message: 'Alert deleted successfully' });
  } catch (err) {
    console.error('Alert deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get alerts by asset
router.get('/asset/:asset_id', authenticateToken, async (req, res) => {
  try {
    const [alerts] = await db.query(
      'SELECT * FROM Alerts WHERE asset_id = ? ORDER BY created_at DESC',
      [req.params.asset_id]
    );
    
    res.json(alerts);
  } catch (err) {
    console.error('Asset alerts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get active alerts summary
router.get('/summary/active', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  try {
    const [summary] = await db.query(`
      SELECT 
        severity,
        COUNT(*) as count,
        MAX(created_at) as latest_alert
      FROM Alerts
      WHERE acknowledged = 0
      GROUP BY severity
    `);
    
    const [[total]] = await db.query(
      'SELECT COUNT(*) as total FROM Alerts WHERE acknowledged = 0'
    );
    
    res.json({ summary, total: total.total });
  } catch (err) {
    console.error('Alert summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
