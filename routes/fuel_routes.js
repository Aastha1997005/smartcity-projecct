const express = require('express');
const router = express.Router();
const {db} = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * FUEL MANAGEMENT ROUTES
 * Manages fuel utilities including types, pricing, and consumption tracking
 * Links to vehicles through consumes relationship
 */

// Get all fuel types/utilities
router.get('/', async (req, res) => {
  try {
    const [fuels] = await db.query(`
      SELECT f.*, u.unit, u.issue_date,
             COUNT(DISTINCT v.vehicle_no) as vehicle_count
      FROM Fuel f
      JOIN Utility u ON f.fuel_id = u.utility_id
      LEFT JOIN Vehicle v ON f.fuel_id = v.consumes_fuel_id
      GROUP BY f.fuel_id
      ORDER BY f.fuel_id
    `);
    
    res.json(fuels);
  } catch (err) {
    console.error('Fuel list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get fuel by ID with consumption statistics
router.get('/:fuel_id', async (req, res) => {
  try {
    const [[fuel]] = await db.query(`
      SELECT f.*, u.unit, u.issue_date
      FROM Fuel f
      JOIN Utility u ON f.fuel_id = u.utility_id
      WHERE f.fuel_id = ?
    `, [req.params.fuel_id]);
    
    if (!fuel) {
      return res.status(404).json({ error: 'Fuel type not found' });
    }
    
    // Get vehicles using this fuel
    const [vehicles] = await db.query(`
      SELECT v.vehicle_no, v.type, v.model,
             CONCAT(c.first_name, ' ', c.last_name) as owner_name
      FROM Vehicle v
      LEFT JOIN Citizen c ON v.owner_citizen_id = c.citizen_id
      WHERE v.consumes_fuel_id = ?
    `, [req.params.fuel_id]);
    
    // Get consumption records
    const [consumptions] = await db.query(`
      SELECT c.*, v.vehicle_no, v.type as vehicle_type
      FROM Consumes c
      JOIN Vehicle v ON c.vehicle_id = v.vehicle_no
      WHERE c.fuel_id = ?
      ORDER BY c.date DESC, c.time DESC
      LIMIT 50
    `, [req.params.fuel_id]);
    
    // Calculate statistics
    const totalQuantity = consumptions.reduce((sum, c) => sum + parseFloat(c.quantity || 0), 0);
    const totalCost = consumptions.reduce((sum, c) => sum + parseFloat(c.Cost || 0), 0);
    
    res.json({
      fuel,
      vehicles,
      vehicleCount: vehicles.length,
      recentConsumptions: consumptions,
      statistics: {
        totalQuantity,
        totalCost,
        averageConsumption: consumptions.length > 0 ? totalQuantity / consumptions.length : 0
      }
    });
  } catch (err) {
    console.error('Fuel detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new fuel type (admin/utility role)
router.post('/', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  const { type, price_per_unit, provider_id, cost_per_month, unit, issue_date } = req.body;
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // Create Utility record first (as per schema: fuel_id references utility_id)
    const [utilityResult] = await connection.query(
      'INSERT INTO Utility (unit, issue_date) VALUES (?, ?)',
      [unit || 'liters', issue_date || new Date()]
    );
    
    const fuelId = utilityResult.insertId;
    
    // Create Fuel record
    await connection.query(
      'INSERT INTO Fuel (fuel_id, type, price_per_unit, provider_id, cost_per_month) VALUES (?, ?, ?, ?, ?)',
      [fuelId, type, price_per_unit, provider_id, cost_per_month]
    );
    
    // Create Service record for booking functionality
    await connection.query(
      'INSERT INTO Service (service_id, service_name, cost, availability_status, operating_hours) VALUES (?, ?, ?, ?, ?)',
      [fuelId, `Fuel - ${type}`, cost_per_month || 0, 'Active', '24/7']
    );
    
    await connection.commit();
    res.json({ message: 'Fuel type created successfully', fuel_id: fuelId });
  } catch (err) {
    await connection.rollback();
    console.error('Fuel creation error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Update fuel type
router.put('/:fuel_id', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  const { type, price_per_unit, provider_id, cost_per_month } = req.body;
  
  try {
    const updates = [];
    const params = [];
    
    if (type) { updates.push('type = ?'); params.push(type); }
    if (price_per_unit !== undefined) { updates.push('price_per_unit = ?'); params.push(price_per_unit); }
    if (provider_id) { updates.push('provider_id = ?'); params.push(provider_id); }
    if (cost_per_month !== undefined) { updates.push('cost_per_month = ?'); params.push(cost_per_month); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(req.params.fuel_id);
    await db.query(
      `UPDATE Fuel SET ${updates.join(', ')} WHERE fuel_id = ?`,
      params
    );
    
    res.json({ message: 'Fuel type updated successfully' });
  } catch (err) {
    console.error('Fuel update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete fuel type
router.delete('/:fuel_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Check if any vehicles are using this fuel
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) as count FROM Vehicle WHERE consumes_fuel_id = ?',
      [req.params.fuel_id]
    );
    
    if (count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete fuel type: ${count} vehicles are using this fuel` 
      });
    }
    
    await db.query('DELETE FROM Fuel WHERE fuel_id = ?', [req.params.fuel_id]);
    res.json({ message: 'Fuel type deleted successfully' });
  } catch (err) {
    console.error('Fuel deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Record fuel consumption
router.post('/consumption', authenticateToken, async (req, res) => {
  const { fuel_id, vehicle_id, quantity, cost, time, date } = req.body;
  
  if (!fuel_id || !vehicle_id || !quantity) {
    return res.status(400).json({ error: 'fuel_id, vehicle_id, and quantity are required' });
  }
  
  try {
    await db.query(
      'INSERT INTO Consumes (fuel_id, vehicle_id, time, date, quantity, Cost) VALUES (?, ?, ?, ?, ?, ?)',
      [
        fuel_id, 
        vehicle_id, 
        time || new Date().toTimeString().split(' ')[0], 
        date || new Date().toISOString().split('T')[0],
        quantity,
        cost || 0
      ]
    );
    
    res.json({ message: 'Fuel consumption recorded successfully' });
  } catch (err) {
    console.error('Consumption recording error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get consumption history for a vehicle
router.get('/consumption/vehicle/:vehicle_id', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    
    let sql = `
      SELECT c.*, f.type as fuel_type, f.price_per_unit
      FROM Consumes c
      JOIN Fuel f ON c.fuel_id = f.fuel_id
      WHERE c.vehicle_id = ?
    `;
    const params = [req.params.vehicle_id];
    
    if (from_date) {
      sql += ' AND c.date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND c.date <= ?';
      params.push(to_date);
    }
    
    sql += ' ORDER BY c.date DESC, c.time DESC';
    
    const [consumptions] = await db.query(sql, params);
    
    // Calculate totals
    const totalQuantity = consumptions.reduce((sum, c) => sum + parseFloat(c.quantity || 0), 0);
    const totalCost = consumptions.reduce((sum, c) => sum + parseFloat(c.Cost || 0), 0);
    
    res.json({
      consumptions,
      summary: {
        recordCount: consumptions.length,
        totalQuantity,
        totalCost,
        averageConsumption: consumptions.length > 0 ? totalQuantity / consumptions.length : 0,
        averageCost: consumptions.length > 0 ? totalCost / consumptions.length : 0
      }
    });
  } catch (err) {
    console.error('Consumption history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get consumption statistics by fuel type
router.get('/statistics/by-type', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT f.type, f.fuel_id,
             COUNT(DISTINCT c.vehicle_id) as vehicle_count,
             SUM(c.quantity) as total_quantity,
             SUM(c.Cost) as total_cost,
             AVG(c.quantity) as avg_quantity
      FROM Fuel f
      LEFT JOIN Consumes c ON f.fuel_id = c.fuel_id
      GROUP BY f.fuel_id
      ORDER BY total_quantity DESC
    `);
    
    res.json(stats);
  } catch (err) {
    console.error('Fuel statistics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get monthly consumption trends
router.get('/trends/monthly', authenticateToken, authorizeRoles('admin', 'utility'), async (req, res) => {
  try {
    const { months = 6 } = req.query;
    
    const [trends] = await db.query(`
      SELECT 
        DATE_FORMAT(c.date, '%Y-%m') as month,
        f.type as fuel_type,
        SUM(c.quantity) as total_quantity,
        SUM(c.Cost) as total_cost,
        COUNT(*) as transaction_count
      FROM Consumes c
      JOIN Fuel f ON c.fuel_id = f.fuel_id
      WHERE c.date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY month, f.fuel_id
      ORDER BY month DESC, f.type
    `, [parseInt(months)]);
    
    res.json(trends);
  } catch (err) {
    console.error('Fuel trends error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;