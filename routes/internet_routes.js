const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * INTERNET/CONNECTIVITY SERVICES ROUTES
 * Manages internet service providers, bandwidth, coverage areas
 * Handles connectivity service bookings and issues
 */

// Get all internet services
router.get('/', async (req, res) => {
  try {
    const [internetServices] = await db.query(`
      SELECT i.*, u.unit, u.issue_date,
             s.service_name, s.availability_status, s.operating_hours,
             COUNT(DISTINCT b.booking_id) as active_connections
      FROM Internet i
      JOIN Utility u ON i.internet_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      LEFT JOIN Service_Booking b ON i.internet_id = b.service_id 
        AND b.status IN ('scheduled', 'in_progress')
      GROUP BY i.internet_id
      ORDER BY i.internet_id
    `);
    
    res.json(internetServices);
  } catch (err) {
    console.error('Internet services list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get internet service details by ID
router.get('/:internet_id', async (req, res) => {
  try {
    const [[internet]] = await db.query(`
      SELECT i.*, u.unit, u.issue_date,
             s.service_name, s.availability_status, s.operating_hours,
             s.provider_id, sp.name as provider_name, sp.contact_no
      FROM Internet i
      JOIN Utility u ON i.internet_id = u.utility_id
      LEFT JOIN Service s ON u.utility_id = s.service_id
      LEFT JOIN Service_Provider sp ON s.provider_id = sp.provider_id
      WHERE i.internet_id = ?
    `, [req.params.internet_id]);
    
    if (!internet) {
      return res.status(404).json({ error: 'Internet service not found' });
    }
    
    // Get active connections/bookings
    const [connections] = await db.query(`
      SELECT b.booking_id, b.booking_start, b.booking_end, b.status,
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             c.area, c.city, c.citizen_id
      FROM Service_Booking b
      JOIN Citizen c ON b.citizen_id = c.citizen_id
      WHERE b.service_id = ?
      ORDER BY b.booking_start DESC
      LIMIT 50
    `, [req.params.internet_id]);
    
    // Get contact information
    const [phones] = await db.query(
      'SELECT phone_number FROM Service_Phone_Number WHERE service_id = ?',
      [req.params.internet_id]
    );
    
    const [emails] = await db.query(
      'SELECT email FROM Service_Emails WHERE service_id = ?',
      [req.params.internet_id]
    );
    
    res.json({
      internet,
      connections,
      contacts: {
        phones: phones.map(p => p.phone_number),
        emails: emails.map(e => e.email)
      },
      statistics: {
        activeConnections: connections.filter(c => c.status === 'in_progress').length,
        totalConnections: connections.length,
        bandwidth: internet.bandwidth,
        coverageArea: internet.coverage_area,
        serviceType: internet.service_type,
        monthlyRate: internet.cost_per_month
      }
    });
  } catch (err) {
    console.error('Internet service detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new internet service
router.post('/', authenticateToken, authorizeRoles('admin', 'internet'), async (req, res) => {
  const { 
    provider_name, bandwidth, coverage_area, 
    cost_per_month, service_type, unit, issue_date,
    service_name, availability_status, operating_hours,
    phones, emails
  } = req.body;
  
  if (!provider_name || !bandwidth) {
    return res.status(400).json({ error: 'provider_name and bandwidth are required' });
  }
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // Create Utility record
    const [utilityResult] = await connection.query(
      'INSERT INTO Utility (unit, issue_date) VALUES (?, ?)',
      [unit || 'monthly', issue_date || new Date()]
    );
    
    const internetId = utilityResult.insertId;
    
    // Create Internet record
    await connection.query(
      'INSERT INTO Internet (internet_id, provider_name, bandwidth, coverage_area, cost_per_month, service_type) VALUES (?, ?, ?, ?, ?, ?)',
      [internetId, provider_name, bandwidth, coverage_area, cost_per_month, service_type]
    );
    
    // Create Service record
    await connection.query(
      'INSERT INTO Service (service_id, service_name, cost, availability_status, operating_hours) VALUES (?, ?, ?, ?, ?)',
      [
        internetId, 
        service_name || `Internet - ${provider_name}`, 
        cost_per_month || 0, 
        availability_status || 'Active',
        operating_hours || '24/7'
      ]
    );
    
    // Add contact phones
    if (phones && Array.isArray(phones)) {
      for (const phone of phones) {
        await connection.query(
          'INSERT INTO Service_Phone_Number (service_id, phone_number) VALUES (?, ?)',
          [internetId, phone]
        );
      }
    }
    
    // Add contact emails
    if (emails && Array.isArray(emails)) {
      for (const email of emails) {
        await connection.query(
          'INSERT INTO Service_Emails (service_id, email) VALUES (?, ?)',
          [internetId, email]
        );
      }
    }
    
    await connection.commit();
    res.json({ message: 'Internet service created successfully', internet_id: internetId });
  } catch (err) {
    await connection.rollback();
    console.error('Internet service creation error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Update internet service
router.put('/:internet_id', authenticateToken, authorizeRoles('admin', 'internet'), async (req, res) => {
  const { provider_name, bandwidth, coverage_area, cost_per_month, service_type } = req.body;
  
  try {
    const updates = [];
    const params = [];
    
    if (provider_name) { updates.push('provider_name = ?'); params.push(provider_name); }
    if (bandwidth) { updates.push('bandwidth = ?'); params.push(bandwidth); }
    if (coverage_area) { updates.push('coverage_area = ?'); params.push(coverage_area); }
    if (cost_per_month !== undefined) { updates.push('cost_per_month = ?'); params.push(cost_per_month); }
    if (service_type) { updates.push('service_type = ?'); params.push(service_type); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(req.params.internet_id);
    await db.query(
      `UPDATE Internet SET ${updates.join(', ')} WHERE internet_id = ?`,
      params
    );
    
    res.json({ message: 'Internet service updated successfully' });
  } catch (err) {
    console.error('Internet service update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete internet service
router.delete('/:internet_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Check active connections
    const [[{ count }]] = await db.query(
      "SELECT COUNT(*) as count FROM Service_Booking WHERE service_id = ? AND status IN ('scheduled', 'in_progress')",
      [req.params.internet_id]
    );
    
    if (count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete internet service: ${count} active connections exist` 
      });
    }
    
    await db.query('DELETE FROM Internet WHERE internet_id = ?', [req.params.internet_id]);
    res.json({ message: 'Internet service deleted successfully' });
  } catch (err) {
    console.error('Internet service deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get connections for internet service
router.get('/:internet_id/connections', async (req, res) => {
  try {
    const { status } = req.query;
    
    let sql = `
      SELECT b.booking_id, b.booking_start, b.booking_end, b.status, b.details,
             CONCAT(c.first_name, ' ', c.last_name) as customer_name,
             c.citizen_id, c.area, c.city, c.street
      FROM Service_Booking b
      JOIN Citizen c ON b.citizen_id = c.citizen_id
      WHERE b.service_id = ?
    `;
    const params = [req.params.internet_id];
    
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY b.booking_start DESC';
    
    const [connections] = await db.query(sql, params);
    res.json(connections);
  } catch (err) {
    console.error('Internet connections error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Request new connection (citizen)
router.post('/:internet_id/request-connection', authenticateToken, async (req, res) => {
  const { citizen_id, installation_address, preferred_plan, contact_number } = req.body;
  
  if (!citizen_id || !installation_address) {
    return res.status(400).json({ error: 'citizen_id and installation_address are required' });
  }
  
  try {
    const [result] = await db.query(
      `INSERT INTO Service_Booking 
       (citizen_id, service_id, booking_start, status, details, priority)
       VALUES (?, ?, NOW(), 'upcoming', ?, 'medium')`,
      [
        citizen_id,
        req.params.internet_id,
        JSON.stringify({ 
          installation_address, 
          preferred_plan: preferred_plan || 'standard',
          contact_number 
        })
      ]
    );
    
    res.json({ 
      message: 'Connection request submitted successfully',
      booking_id: result.insertId
    });
  } catch (err) {
    console.error('Connection request error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Report connectivity issue
router.post('/:internet_id/report-issue', authenticateToken, async (req, res) => {
  const { issue_type, description, citizen_id, connection_details } = req.body;
  
  if (!issue_type || !description) {
    return res.status(400).json({ error: 'issue_type and description are required' });
  }
  
  try {
    const userId = req.user && req.user.id;
    
    // Create maintenance task
    const [result] = await db.query(`
      INSERT INTO Maintenance_Task 
      (task_type, description, status, priority, created_by)
      VALUES (?, ?, 'Scheduled', 'high', ?)
    `, [
      `internet_issue_${issue_type}`,
      `Internet Connectivity Issue: ${issue_type}\nCitizen: ${citizen_id || 'N/A'}\nConnection Details: ${connection_details || 'N/A'}\nDescription: ${description}`,
      userId
    ]);
    
    res.json({ 
      message: 'Connectivity issue reported successfully',
      task_id: result.insertId
    });
  } catch (err) {
    console.error('Issue reporting error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get internet service statistics
router.get('/statistics/overview', authenticateToken, authorizeRoles('admin', 'internet'), async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT 
        i.internet_id,
        i.provider_name,
        i.bandwidth,
        i.coverage_area,
        COUNT(DISTINCT b.booking_id) as total_connections,
        SUM(CASE WHEN b.status = 'in_progress' THEN 1 ELSE 0 END) as active_connections,
        AVG(i.cost_per_month) as avg_monthly_cost
      FROM Internet i
      LEFT JOIN Service_Booking b ON i.internet_id = b.service_id
      GROUP BY i.internet_id
      ORDER BY total_connections DESC
    `);
    
    res.json(stats);
  } catch (err) {
    console.error('Internet statistics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get services by coverage area
router.get('/by-coverage/:area', async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT i.*, s.availability_status
      FROM Internet i
      LEFT JOIN Service s ON i.internet_id = s.service_id
      WHERE i.coverage_area LIKE ?
      ORDER BY i.bandwidth DESC
    `, [`%${req.params.area}%`]);
    
    res.json(results);
  } catch (err) {
    console.error('Internet by coverage error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get services by bandwidth
router.get('/by-bandwidth', async (req, res) => {
  try {
    const { min_bandwidth } = req.query;
    
    let sql = 'SELECT i.*, s.availability_status FROM Internet i LEFT JOIN Service s ON i.internet_id = s.service_id';
    const params = [];
    
    if (min_bandwidth) {
      sql += ' WHERE CAST(SUBSTRING_INDEX(i.bandwidth, " ", 1) AS UNSIGNED) >= ?';
      params.push(parseInt(min_bandwidth));
    }
    
    sql += ' ORDER BY CAST(SUBSTRING_INDEX(i.bandwidth, " ", 1) AS UNSIGNED) DESC';
    
    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    console.error('Internet by bandwidth error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Search internet services
router.get('/search', async (req, res) => {
  try {
    const { provider, coverage, service_type, max_cost } = req.query;
    
    let sql = 'SELECT i.*, s.availability_status FROM Internet i LEFT JOIN Service s ON i.internet_id = s.service_id WHERE 1=1';
    const params = [];
    
    if (provider) {
      sql += ' AND i.provider_name LIKE ?';
      params.push(`%${provider}%`);
    }
    if (coverage) {
      sql += ' AND i.coverage_area LIKE ?';
      params.push(`%${coverage}%`);
    }
    if (service_type) {
      sql += ' AND i.service_type LIKE ?';
      params.push(`%${service_type}%`);
    }
    if (max_cost) {
      sql += ' AND i.cost_per_month <= ?';
      params.push(parseFloat(max_cost));
    }
    
    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    console.error('Internet search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get plan comparison
router.get('/compare', async (req, res) => {
  try {
    const [plans] = await db.query(`
      SELECT 
        i.internet_id,
        i.provider_name,
        i.bandwidth,
        i.coverage_area,
        i.cost_per_month,
        i.service_type,
        s.availability_status,
        COUNT(DISTINCT b.booking_id) as customers
      FROM Internet i
      LEFT JOIN Service s ON i.internet_id = s.service_id
      LEFT JOIN Service_Booking b ON i.internet_id = b.service_id
      GROUP BY i.internet_id
      ORDER BY i.cost_per_month, i.bandwidth DESC
    `);
    
    res.json(plans);
  } catch (err) {
    console.error('Plan comparison error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;