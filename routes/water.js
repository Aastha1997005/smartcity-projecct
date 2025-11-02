const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * WATER SUPPLY ROUTES
 * Manages water utilities including sources, distribution, quality, and pipelines
 */

// Get all water services
router.get('/', async (req, res) => {
  try {
    const [waterServices] = await db.query(`
      SELECT w.*, u.unit, u.issue_date,
             s.service_name, s.availability_status, s.operating_hours,
             COUNT(DISTINCT pt.pipeline_id) as pipeline_count
      FROM Water w
      JOIN Utility u ON w.water_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      LEFT JOIN provided_through pt ON w.water_id = pt.water_id
      GROUP BY w.water_id
      ORDER BY w.water_id
    `);
    
    res.json(waterServices);
  } catch (err) {
    console.error('Water services list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get water service details by ID
router.get('/:water_id', async (req, res) => {
  try {
    const [[water]] = await db.query(`
      SELECT w.*, u.unit, u.issue_date,
             s.service_name, s.availability_status, s.operating_hours,
             s.provider_id, sp.name as provider_name, sp.contact_no
      FROM Water w
      JOIN Utility u ON w.water_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      LEFT JOIN Service_Provider sp ON s.provider_id = sp.provider_id
      WHERE w.water_id = ?
    `, [req.params.water_id]);
    
    if (!water) {
      return res.status(404).json({ error: 'Water service not found' });
    }
    
    // Get associated pipelines
    const [pipelines] = await db.query(`
      SELECT p.*, i.zone_id, z.zone_name
      FROM provided_through pt
      JOIN Pipeline p ON pt.pipeline_id = p.pipeline_id
      JOIN Infrastructure i ON p.pipeline_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE pt.water_id = ?
    `, [req.params.water_id]);
    
    // Get contact information
    const [phones] = await db.query(
      'SELECT phone_number FROM Service_Phone_Number WHERE service_id = ?',
      [req.params.water_id]
    );
    
    const [emails] = await db.query(
      'SELECT email FROM Service_Emails WHERE service_id = ?',
      [req.params.water_id]
    );
    
    res.json({
      water,
      pipelines,
      contacts: {
        phones: phones.map(p => p.phone_number),
        emails: emails.map(e => e.email)
      },
      statistics: {
        pipelineCount: pipelines.length,
        totalPipelineLength: pipelines.reduce((sum, p) => sum + (parseFloat(p.length) || 0), 0),
        source: water.source,
        qualityLevel: water.quality_level,
        costPerLitre: water.cost_per_litre,
        distributionArea: water.distribution_area,
        supplyHours: water.supply_hours
      }
    });
  } catch (err) {
    console.error('Water service detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new water service
router.post('/', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  const { 
    source, cost_per_litre, distribution_area, quality_level, supply_hours,
    unit, issue_date, service_name, availability_status, operating_hours,
    phones, emails
  } = req.body;
  
  if (!source || !distribution_area) {
    return res.status(400).json({ error: 'source and distribution_area are required' });
  }
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // Create Utility record
    const [utilityResult] = await connection.query(
      'INSERT INTO Utility (unit, issue_date) VALUES (?, ?)',
      [unit || 'KL', issue_date || new Date()]
    );
    
    const waterId = utilityResult.insertId;
    
    // Create Water record
    await connection.query(
      'INSERT INTO Water (water_id, source, cost_per_litre, distribution_area, quality_level, supply_hours) VALUES (?, ?, ?, ?, ?, ?)',
      [waterId, source, cost_per_litre, distribution_area, quality_level, supply_hours]
    );
    
    // Create Service record
    await connection.query(
      'INSERT INTO Service (service_id, service_name, cost, availability_status, operating_hours) VALUES (?, ?, ?, ?, ?)',
      [waterId, service_name || `Water Supply - ${source}`, cost_per_litre || 0, availability_status || 'Active', operating_hours || supply_hours || '24/7']
    );
    
    // Add contact phones
    if (phones && Array.isArray(phones)) {
      for (const phone of phones) {
        await connection.query(
          'INSERT INTO Service_Phone_Number (service_id, phone_number) VALUES (?, ?)',
          [waterId, phone]
        );
      }
    }
    
    // Add contact emails
    if (emails && Array.isArray(emails)) {
      for (const email of emails) {
        await connection.query(
          'INSERT INTO Service_Emails (service_id, email) VALUES (?, ?)',
          [waterId, email]
        );
      }
    }
    
    await connection.commit();
    res.json({ message: 'Water service created successfully', water_id: waterId });
  } catch (err) {
    await connection.rollback();
    console.error('Water service creation error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Update water service
router.put('/:water_id', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  const { source, cost_per_litre, distribution_area, quality_level, supply_hours } = req.body;
  
  try {
    const updates = [];
    const params = [];
    
    if (source) { updates.push('source = ?'); params.push(source); }
    if (cost_per_litre !== undefined) { updates.push('cost_per_litre = ?'); params.push(cost_per_litre); }
    if (distribution_area) { updates.push('distribution_area = ?'); params.push(distribution_area); }
    if (quality_level) { updates.push('quality_level = ?'); params.push(quality_level); }
    if (supply_hours) { updates.push('supply_hours = ?'); params.push(supply_hours); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(req.params.water_id);
    await db.query(`UPDATE Water SET ${updates.join(', ')} WHERE water_id = ?`, params);
    
    res.json({ message: 'Water service updated successfully' });
  } catch (err) {
    console.error('Water service update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete water service
router.delete('/:water_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM Water WHERE water_id = ?', [req.params.water_id]);
    res.json({ message: 'Water service deleted successfully' });
  } catch (err) {
    console.error('Water service deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Link pipeline to water service
router.post('/:water_id/pipelines/:pipeline_id', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  try {
    await db.query(
      'INSERT INTO provided_through (pipeline_id, water_id) VALUES (?, ?)',
      [req.params.pipeline_id, req.params.water_id]
    );
    res.json({ message: 'Pipeline linked to water service successfully' });
  } catch (err) {
    console.error('Pipeline link error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unlink pipeline from water service
router.delete('/:water_id/pipelines/:pipeline_id', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  try {
    await db.query(
      'DELETE FROM provided_through WHERE pipeline_id = ? AND water_id = ?',
      [req.params.pipeline_id, req.params.water_id]
    );
    res.json({ message: 'Pipeline unlinked from water service' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report water quality issue
router.post('/:water_id/report-issue', authenticateToken, async (req, res) => {
  const { issue_type, description, location, citizen_id } = req.body;
  
  if (!issue_type || !description) {
    return res.status(400).json({ error: 'issue_type and description are required' });
  }
  
  try {
    const userId = req.user && req.user.id;
    
    const [result] = await db.query(`
      INSERT INTO Maintenance_Task 
      (task_type, description, status, priority, created_by)
      VALUES (?, ?, 'Scheduled', 'high', ?)
    `, [
      `water_issue_${issue_type}`,
      `Water Quality Issue: ${issue_type}\nLocation: ${location || 'N/A'}\nCitizen: ${citizen_id || 'N/A'}\nDescription: ${description}`,
      userId
    ]);
    
    res.json({ message: 'Water issue reported successfully', task_id: result.insertId });
  } catch (err) {
    console.error('Issue reporting error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
