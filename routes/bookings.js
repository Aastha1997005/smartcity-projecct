const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * SERVICE BOOKINGS ROUTES
 * Manages service bookings/appointments for all services
 */

// Get all bookings with filtering
router.get('/', authenticateToken, authorizeRoles('admin', 'utility', 'transport', 'healthcare'), async (req, res) => {
  try {
    const { status, service_id, citizen_id, from_date, to_date, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT b.*, 
             CONCAT(c.first_name, ' ', c.last_name) as citizen_name,
             s.service_name,
             b.service_category_cache as category
      FROM Service_Booking b
      JOIN Citizen c ON b.citizen_id = c.citizen_id
      LEFT JOIN Service s ON b.service_id = s.service_id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    if (service_id) {
      sql += ' AND b.service_id = ?';
      params.push(service_id);
    }
    if (citizen_id) {
      sql += ' AND b.citizen_id = ?';
      params.push(citizen_id);
    }
    if (from_date) {
      sql += ' AND b.booking_start >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND b.booking_start <= ?';
      params.push(to_date);
    }
    
    sql += ' ORDER BY b.booking_start DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [bookings] = await db.query(sql, params);
    
    const [summary] = await db.query(`
      SELECT status, COUNT(*) as count
      FROM Service_Booking
      GROUP BY status
    `);
    
    res.json({ bookings, summary });
  } catch (err) {
    console.error('Bookings list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get booking by ID
router.get('/:booking_id', authenticateToken, async (req, res) => {
  try {
    const [[booking]] = await db.query(`
      SELECT b.*, 
             CONCAT(c.first_name, ' ', c.last_name) as citizen_name,
             c.area, c.city,
             s.service_name, s.cost,
             sp.name as provider_name
      FROM Service_Booking b
      JOIN Citizen c ON b.citizen_id = c.citizen_id
      LEFT JOIN Service s ON b.service_id = s.service_id
      LEFT JOIN Service_Provider sp ON b.provider_id = sp.provider_id
      WHERE b.booking_id = ?
    `, [req.params.booking_id]);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json(booking);
  } catch (err) {
    console.error('Booking detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new booking
router.post('/', authenticateToken, async (req, res) => {
  const { citizen_id, service_id, booking_start, booking_end, details, priority } = req.body;
  const userId = req.user && req.user.id;
  
  if (!citizen_id || !service_id || !booking_start) {
    return res.status(400).json({ error: 'citizen_id, service_id, and booking_start are required' });
  }
  
  try {
    // Check for overlapping bookings for the citizen
    const overlapSql = `
      SELECT COUNT(*) AS cnt 
      FROM Service_Booking 
      WHERE citizen_id = ? 
        AND status IN ('upcoming','scheduled','in_progress')
        AND NOT (booking_end <= ? OR booking_start >= ?)
    `;
    const [[overlap]] = await db.query(overlapSql, [
      citizen_id, 
      booking_start, 
      booking_end || booking_start
    ]);
    
    if (overlap.cnt > 0) {
      return res.status(409).json({ error: 'Overlapping booking exists for this citizen' });
    }
    
    // Check service availability
    const overlapServiceSql = `
      SELECT COUNT(*) AS cnt 
      FROM Service_Booking 
      WHERE service_id = ? 
        AND status IN ('upcoming','scheduled','in_progress')
        AND NOT (booking_end <= ? OR booking_start >= ?)
    `;
    const [[serviceOverlap]] = await db.query(overlapServiceSql, [
      service_id,
      booking_start,
      booking_end || booking_start
    ]);
    
    if (serviceOverlap.cnt > 0) {
      return res.status(409).json({ error: 'Service is already booked for this time slot' });
    }
    
    // Create booking
    const [result] = await db.query(
      `INSERT INTO Service_Booking 
       (citizen_id, service_id, booking_start, booking_end, details, priority, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        citizen_id,
        service_id,
        booking_start,
        booking_end || booking_start,
        JSON.stringify(details || {}),
        priority || 'medium',
        userId
      ]
    );
    
    const bookingId = result.insertId;
    
    // Auto-fill cache fields
    const [[service]] = await db.query('SELECT service_name, provider_id FROM Service WHERE service_id = ?', [service_id]);
    
    let category = null;
    const [catRows] = await db.query(
      `SELECT sc.name 
       FROM Service_Category_Map scm 
       JOIN Service_Category sc ON scm.category_id = sc.category_id 
       WHERE scm.service_id = ? 
       LIMIT 1`,
      [service_id]
    );
    if (catRows.length) category = catRows[0].name;
    
    await db.query(
      'UPDATE Service_Booking SET service_name_cache = ?, service_category_cache = ?, provider_id = ? WHERE booking_id = ?',
      [service?.service_name, category, service?.provider_id, bookingId]
    );
    
    res.json({ message: 'Booking created successfully', booking_id: bookingId });
  } catch (err) {
    console.error('Booking creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update booking
router.put('/:booking_id', authenticateToken, async (req, res) => {
  const { status, booking_start, booking_end, details, priority, assigned_to } = req.body;
  
  try {
    const updates = [];
    const params = [];
    
    if (status) { updates.push('status = ?'); params.push(status); }
    if (booking_start) { updates.push('booking_start = ?'); params.push(booking_start); }
    if (booking_end) { updates.push('booking_end = ?'); params.push(booking_end); }
    if (details) { updates.push('details = ?'); params.push(JSON.stringify(details)); }
    if (priority) { updates.push('priority = ?'); params.push(priority); }
    if (assigned_to) { updates.push('assigned_to = ?'); params.push(assigned_to); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push('updated_at = NOW()');
    params.push(req.params.booking_id);
    
    await db.query(
      `UPDATE Service_Booking SET ${updates.join(', ')} WHERE booking_id = ?`,
      params
    );
    
    res.json({ message: 'Booking updated successfully' });
  } catch (err) {
    console.error('Booking update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel booking
router.put('/:booking_id/cancel', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'UPDATE Service_Booking SET status = ?, updated_at = NOW() WHERE booking_id = ?',
      ['cancelled', req.params.booking_id]
    );
    
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    console.error('Booking cancellation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete booking
router.delete('/:booking_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM Service_Booking WHERE booking_id = ?', [req.params.booking_id]);
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error('Booking deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get bookings by citizen
router.get('/citizen/:citizen_id', authenticateToken, async (req, res) => {
  try {
    const [bookings] = await db.query(`
      SELECT b.*, s.service_name, b.service_category_cache as category
      FROM Service_Booking b
      LEFT JOIN Service s ON b.service_id = s.service_id
      WHERE b.citizen_id = ?
      ORDER BY b.booking_start DESC
    `, [req.params.citizen_id]);
    
    res.json(bookings);
  } catch (err) {
    console.error('Citizen bookings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get bookings by service
router.get('/service/:service_id', authenticateToken, async (req, res) => {
  try {
    const [bookings] = await db.query(`
      SELECT b.*, CONCAT(c.first_name, ' ', c.last_name) as citizen_name
      FROM Service_Booking b
      JOIN Citizen c ON b.citizen_id = c.citizen_id
      WHERE b.service_id = ?
      ORDER BY b.booking_start DESC
    `, [req.params.service_id]);
    
    res.json(bookings);
  } catch (err) {
    console.error('Service bookings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get upcoming bookings
router.get('/upcoming/all', authenticateToken, async (req, res) => {
  try {
    const [bookings] = await db.query(`
      SELECT b.*, 
             CONCAT(c.first_name, ' ', c.last_name) as citizen_name,
             s.service_name
      FROM Service_Booking b
      JOIN Citizen c ON b.citizen_id = c.citizen_id
      LEFT JOIN Service s ON b.service_id = s.service_id
      WHERE b.booking_start >= NOW()
        AND b.status IN ('upcoming', 'scheduled')
      ORDER BY b.booking_start ASC
      LIMIT 100
    `);
    
    res.json(bookings);
  } catch (err) {
    console.error('Upcoming bookings error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
