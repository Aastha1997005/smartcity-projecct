const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * WASTE MANAGEMENT ROUTES
 * Manages waste collection services, smart bins, and schedules
 */

// Get all waste management services
router.get('/', async (req, res) => {
  try {
    const [wasteServices] = await db.query(`
      SELECT wm.*, u.unit, u.issue_date, z.zone_name,
             COUNT(DISTINCT sb.bin_id) as smart_bin_count
      FROM Waste_Management wm
      JOIN Utility u ON wm.waste_id = u.utility_id
      LEFT JOIN Zone z ON wm.zone_id = z.zone_id
      LEFT JOIN Smart_Bin sb ON wm.waste_id = sb.managing_waste_id
      GROUP BY wm.waste_id
      ORDER BY wm.waste_id
    `);
    
    res.json(wasteServices);
  } catch (err) {
    console.error('Waste management list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get waste management service by ID
router.get('/:waste_id', async (req, res) => {
  try {
    const [[waste]] = await db.query(`
      SELECT wm.*, u.unit, u.issue_date, z.zone_name, z.type as zone_type
      FROM Waste_Management wm
      JOIN Utility u ON wm.waste_id = u.utility_id
      LEFT JOIN Zone z ON wm.zone_id = z.zone_id
      WHERE wm.waste_id = ?
    `, [req.params.waste_id]);
    
    if (!waste) {
      return res.status(404).json({ error: 'Waste management service not found' });
    }
    
    const [smartBins] = await db.query(`
      SELECT sb.*, i.zone_id, z.zone_name
      FROM Smart_Bin sb
      JOIN Infrastructure i ON sb.bin_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE sb.managing_waste_id = ?
    `, [req.params.waste_id]);
    
    res.json({
      waste,
      smartBins,
      statistics: {
        binCount: smartBins.length,
        collectionSchedule: waste.collection_schedule,
        processingMethod: waste.processing_method,
        wasteType: waste.type
      }
    });
  } catch (err) {
    console.error('Waste management detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new waste management service
router.post('/', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  const { collection_schedule, processing_method, type, zone_id, unit, issue_date } = req.body;
  
  if (!collection_schedule || !zone_id) {
    return res.status(400).json({ error: 'collection_schedule and zone_id are required' });
  }
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const [utilityResult] = await connection.query(
      'INSERT INTO Utility (unit, issue_date) VALUES (?, ?)',
      [unit || 'monthly', issue_date || new Date()]
    );
    
    const wasteId = utilityResult.insertId;
    
    await connection.query(
      'INSERT INTO Waste_Management (waste_id, collection_schedule, processing_method, type, zone_id) VALUES (?, ?, ?, ?, ?)',
      [wasteId, collection_schedule, processing_method, type, zone_id]
    );
    
    await connection.commit();
    res.json({ message: 'Waste management service created successfully', waste_id: wasteId });
  } catch (err) {
    await connection.rollback();
    console.error('Waste management creation error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Update waste management service
router.put('/:waste_id', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  const { collection_schedule, processing_method, type, zone_id } = req.body;
  
  try {
    const updates = [];
    const params = [];
    
    if (collection_schedule) { updates.push('collection_schedule = ?'); params.push(collection_schedule); }
    if (processing_method) { updates.push('processing_method = ?'); params.push(processing_method); }
    if (type) { updates.push('type = ?'); params.push(type); }
    if (zone_id) { updates.push('zone_id = ?'); params.push(zone_id); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(req.params.waste_id);
    await db.query(`UPDATE Waste_Management SET ${updates.join(', ')} WHERE waste_id = ?`, params);
    
    res.json({ message: 'Waste management service updated successfully' });
  } catch (err) {
    console.error('Waste management update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete waste management service
router.delete('/:waste_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM Waste_Management WHERE waste_id = ?', [req.params.waste_id]);
    res.json({ message: 'Waste management service deleted successfully' });
  } catch (err) {
    console.error('Waste management deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Report waste collection issue
router.post('/:waste_id/report-issue', authenticateToken, async (req, res) => {
  const { issue_type, description, location, citizen_id } = req.body;
  
  if (!issue_type || !description) {
    return res.status(400).json({ error: 'issue_type and description are required' });
  }
  
  try {
    const userId = req.user && req.user.id;
    
    const [result] = await db.query(`
      INSERT INTO Maintenance_Task 
      (task_type, description, status, priority, created_by)
      VALUES (?, ?, 'Scheduled', 'medium', ?)
    `, [
      `waste_issue_${issue_type}`,
      `Waste Collection Issue: ${issue_type}\nLocation: ${location || 'N/A'}\nCitizen: ${citizen_id || 'N/A'}\nDescription: ${description}`,
      userId
    ]);
    
    res.json({ message: 'Waste issue reported successfully', task_id: result.insertId });
  } catch (err) {
    console.error('Issue reporting error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
