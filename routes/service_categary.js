const express = require('express');
const router = express.Router();
const {db} = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * ===================================
 * SERVICE CATEGORIES ROUTES
 * Manages service category taxonomy and mappings
 * ===================================
 */

/**
 * @route GET /
 * @description Get all service categories (with a count of services in each)
 */
router.get('/', async (req, res) => {
  try {
    const [categories] = await db.query(`
      SELECT sc.*, 
             COUNT(DISTINCT scm.service_id) as service_count
      FROM service_category sc
      LEFT JOIN service_category_map scm ON sc.category_id = scm.category_id
      GROUP BY sc.category_id
      ORDER BY sc.name
    `);
    
    res.json(categories);
  } catch (err) {
    console.error('Categories list error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /:category_id
 * @description Get a single category by ID (and list its services)
 */
router.get('/:category_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM service_category WHERE category_id = ?',
      [req.params.category_id]
    );

    const category = rows && rows.length ? rows[0] : null;
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get services in this category
    const [services] = await db.query(`
      SELECT s.service_id, s.service_name, s.availability_status
      FROM service_category_map scm
      JOIN service s ON scm.service_id = s.service_id
      WHERE scm.category_id = ?
      ORDER BY s.service_name
    `, [req.params.category_id]);
    
    res.json({ category, services });
  } catch (err) {
    console.error('Category detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /
 * @description Create a new category (Admin Only)
 */
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO service_category (name, description) VALUES (?, ?)',
      [name, description || null]
    );
    
    res.status(201).json({ message: 'Category created successfully', category_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A category with this name already exists.' });
    }
    console.error('Category creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route PUT /:category_id
 * @description Update a category (Admin Only)
 */
router.put('/:category_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { name, description } = req.body;
  
  try {
    const updates = [];
    const params = [];
    
    if (name) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(req.params.category_id);
  // Build the SQL string safely (updates already parameterized)
  const sql = `UPDATE service_category SET ${updates.join(', ')} WHERE category_id = ?`;
  const [result] = await db.query(sql, params);

    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Another category already has this name.' });
    }
    console.error('Category update error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route DELETE /:category_id
 * @description Delete a category (Admin Only)
 */
router.delete('/:category_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM service_category WHERE category_id = ?', [req.params.category_id]);

    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({ error: 'Cannot delete. This category is still linked to services. Please unmap them first.' });
    }
    console.error('Category deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /map
 * @description Map a service to a category (Admin Only)
 */
router.post('/map', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { service_id, category_id } = req.body;
  if (!service_id || !category_id) {
    return res.status(400).json({ error: 'service_id and category_id are required.' });
  }
  try {
    // Use ON DUPLICATE KEY to prevent crashes if mapping already exists
    await db.query(
      'INSERT INTO service_category_map (service_id, category_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE category_id=category_id',
      [service_id, category_id]
    );
    
    res.json({ message: 'Service mapped to category successfully' });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(404).json({ error: 'The specified service or category does not exist.' });
    }
    console.error('Category mapping error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route DELETE /unmap
 * @description Unmap a service from a category (Admin Only)
 */
router.delete('/unmap', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { service_id, category_id } = req.body;
  if (!service_id || !category_id) {
    return res.status(400).json({ error: 'service_id and category_id are required.' });
  }
  try {
    const [result] = await db.query(
      'DELETE FROM service_category_map WHERE service_id = ? AND category_id = ?',
      [service_id, category_id]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'This mapping does not exist.' });
    }
    
    res.json({ message: 'Service unmapped from category' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;