const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * ELECTRICITY ROUTES
 * Manages electricity utilities including power nodes, voltage levels, sources
 */

// Get all electricity services
router.get('/', async (req, res) => {
  try {
    const [electricServices] = await db.query(`
      SELECT e.*, u.unit, u.issue_date,
             s.service_name, s.availability_status, s.operating_hours,
             COUNT(DISTINCT pb.node_id) as power_node_count
      FROM Electricity e
      JOIN Utility u ON e.electricity_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      LEFT JOIN provided_by pb ON e.electricity_id = pb.electricity_id
      GROUP BY e.electricity_id
      ORDER BY e.electricity_id
    `);
    
    res.json(electricServices);
  } catch (err) {
    console.error('Electricity services list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get electricity service details by ID
router.get('/:electricity_id', async (req, res) => {
  try {
    const [[electric]] = await db.query(`
      SELECT e.*, u.unit, u.issue_date,
             s.service_name, s.availability_status, s.operating_hours,
             s.provider_id, sp.name as provider_name, sp.contact_no
      FROM Electricity e
      JOIN Utility u ON e.electricity_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      LEFT JOIN Service_Provider sp ON s.provider_id = sp.provider_id
      WHERE e.electricity_id = ?
    `, [req.params.electricity_id]);
    
    if (!electric) {
      return res.status(404).json({ error: 'Electricity service not found' });
    }
    
    // Get power nodes
    const [powerNodes] = await db.query(`
      SELECT pn.*, i.zone_id, z.zone_name
      FROM provided_by pb
      JOIN Powernodes pn ON pb.node_id = pn.node_id
      JOIN Infrastructure i ON pn.node_id = i.asset_id
      LEFT JOIN Zone z ON i.zone_id = z.zone_id
      WHERE pb.electricity_id = ?
    `, [req.params.electricity_id]);
    
    const [phones] = await db.query(
      'SELECT phone_number FROM Service_Phone_Number WHERE service_id = ?',
      [req.params.electricity_id]
    );
    
    const [emails] = await db.query(
      'SELECT email FROM Service_Emails WHERE service_id = ?',
      [req.params.electricity_id]
    );
    
    res.json({
      electric,
      powerNodes,
      contacts: {
        phones: phones.map(p => p.phone_number),
        emails: emails.map(e => e.email)
      },
      statistics: {
        nodeCount: powerNodes.length,
        voltageLevel: electric.voltage_level,
        sourceType: electric.source_type,
        distributionArea: electric.distribution_area,
        trafficRate: electric.traffic_rate
      }
    });
  } catch (err) {
    console.error('Electricity service detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new electricity service
router.post('/', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  const { 
    provider_id, voltage_level, distribution_area, source_type, traffic_rate,
    unit, issue_date, service_name, availability_status, operating_hours,
    phones, emails
  } = req.body;
  
  if (!voltage_level || !distribution_area) {
    return res.status(400).json({ error: 'voltage_level and distribution_area are required' });
  }
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const [utilityResult] = await connection.query(
      'INSERT INTO Utility (unit, issue_date) VALUES (?, ?)',
      [unit || 'monthly', issue_date || new Date()]
    );
    
    const electricityId = utilityResult.insertId;
    
    await connection.query(
      'INSERT INTO Electricity (electricity_id, provider_id, voltage_level, distribution_area, source_type, traffic_rate) VALUES (?, ?, ?, ?, ?, ?)',
      [electricityId, provider_id, voltage_level, distribution_area, source_type, traffic_rate]
    );
    
    await connection.query(
      'INSERT INTO Service (service_id, service_name, cost, availability_status, operating_hours) VALUES (?, ?, ?, ?, ?)',
      [electricityId, service_name || `Electricity - ${source_type || 'Grid'}`, traffic_rate || 0, availability_status || 'Active', operating_hours || '24/7']
    );
    
    if (phones && Array.isArray(phones)) {
      for (const phone of phones) {
        await connection.query(
          'INSERT INTO Service_Phone_Number (service_id, phone_number) VALUES (?, ?)',
          [electricityId, phone]
        );
      }
    }
    
    if (emails && Array.isArray(emails)) {
      for (const email of emails) {
        await connection.query(
          'INSERT INTO Service_Emails (service_id, email) VALUES (?, ?)',
          [electricityId, email]
        );
      }
    }
    
    await connection.commit();
    res.json({ message: 'Electricity service created successfully', electricity_id: electricityId });
  } catch (err) {
    await connection.rollback();
    console.error('Electricity service creation error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Update electricity service
router.put('/:electricity_id', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  const { provider_id, voltage_level, distribution_area, source_type, traffic_rate } = req.body;
  
  try {
    const updates = [];
    const params = [];
    
    if (provider_id) { updates.push('provider_id = ?'); params.push(provider_id); }
    if (voltage_level) { updates.push('voltage_level = ?'); params.push(voltage_level); }
    if (distribution_area) { updates.push('distribution_area = ?'); params.push(distribution_area); }
    if (source_type) { updates.push('source_type = ?'); params.push(source_type); }
    if (traffic_rate !== undefined) { updates.push('traffic_rate = ?'); params.push(traffic_rate); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(req.params.electricity_id);
    await db.query(`UPDATE Electricity SET ${updates.join(', ')} WHERE electricity_id = ?`, params);
    
    res.json({ message: 'Electricity service updated successfully' });
  } catch (err) {
    console.error('Electricity service update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete electricity service
router.delete('/:electricity_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM Electricity WHERE electricity_id = ?', [req.params.electricity_id]);
    res.json({ message: 'Electricity service deleted successfully' });
  } catch (err) {
    console.error('Electricity service deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Link power node to electricity service
router.post('/:electricity_id/powernodes/:node_id', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  try {
    await db.query(
      'INSERT INTO provided_by (electricity_id, node_id) VALUES (?, ?)',
      [req.params.electricity_id, req.params.node_id]
    );
    res.json({ message: 'Power node linked to electricity service successfully' });
  } catch (err) {
    console.error('Power node link error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unlink power node from electricity service
router.delete('/:electricity_id/powernodes/:node_id', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  try {
    await db.query(
      'DELETE FROM provided_by WHERE electricity_id = ? AND node_id = ?',
      [req.params.electricity_id, req.params.node_id]
    );
    res.json({ message: 'Power node unlinked from electricity service' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report power outage
router.post('/:electricity_id/report-outage', authenticateToken, async (req, res) => {
  const { location, description, citizen_id, affected_area } = req.body;
  
  if (!location || !description) {
    return res.status(400).json({ error: 'location and description are required' });
  }
  
  try {
    const userId = req.user && req.user.id;
    
    const [result] = await db.query(`
      INSERT INTO Maintenance_Task 
      (task_type, description, status, priority, created_by)
      VALUES (?, ?, 'Scheduled', 'high', ?)
    `, [
      'power_outage',
      `Power Outage\nLocation: ${location}\nAffected Area: ${affected_area || 'N/A'}\nCitizen: ${citizen_id || 'N/A'}\nDescription: ${description}`,
      userId
    ]);
    
    res.json({ message: 'Power outage reported successfully', task_id: result.insertId });
  } catch (err) {
    console.error('Outage reporting error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
