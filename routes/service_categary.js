const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * SERVICE CATEGORIES ROUTES
 * Manages service category taxonomy and mappings
 */

// Get all service categories
router.get('/', async (req, res) => {
  try {
    const [categories] = await db.query(`
      SELECT sc.*, 
             COUNT(DISTINCT scm.service_id) as service_count
      FROM Service_Category sc
      LEFT JOIN Service_Category_Map scm ON sc.category_id = scm.category_id
      GROUP BY sc.category_id
      ORDER BY sc.name
    `);
    
    res.json(categories);
  } catch (err) {
    console.error('Categories list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get category by ID
router.get('/:category_id', async (req, res) => {
  try {
    const [[category]] = await db.query(
      'SELECT * FROM Service_Category WHERE category_id = ?',
      [req.params.category_id]
    );
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get services in this category
    const [services] = await db.query(`
      SELECT s.*
      FROM Service_Category_Map scm
      JOIN Service s ON scm.service_id = s.service_id
      WHERE scm.category_id = ?
    `, [req.params.category_id]);
    
    res.json({ category, services });
  } catch (err) {
    console.error('Category detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new category
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO Service_Category (name, description) VALUES (?, ?)',
      [name, description]
    );
    
    res.json({ message: 'Category created successfully', category_id: result.insertId });
  } catch (err) {
    console.error('Category creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update category
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
    await db.query(
      `UPDATE Service_Category SET ${updates.join(', ')} WHERE category_id = ?`,
      params
    );
    
    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    console.error('Category update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete category
router.delete('/:category_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM Service_Category WHERE category_id = ?', [req.params.category_id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Category deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Map service to category
router.post('/:category_id/services/:service_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await db.query(
      'INSERT INTO Service_Category_Map (service_id, category_id) VALUES (?, ?)',
      [req.params.service_id, req.params.category_id]
    );
    
    res.json({ message: 'Service mapped to category successfully' });
  } catch (err) {
    console.error('Category mapping error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unmap service from category
router.delete('/:category_id/services/:service_id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await db.query(
      'DELETE FROM Service_Category_Map WHERE service_id = ? AND category_id = ?',
      [req.params.service_id, req.params.category_id]
    );
    
    res.json({ message: 'Service unmapped from category' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
