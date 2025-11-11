const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all transport options
router.get('/', async (req, res) => {
    try {
        const [transportServices] = await db.query(`
            SELECT t.*, s.service_name, s.availability_status, s.operating_hours
            FROM Transport t
            JOIN Service s ON t.transport_id = s.service_id
            ORDER BY s.service_name
        `);
        res.json(transportServices);
    } catch (err) {
        console.error('Transport options error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get transport by ID
router.get('/:transport_id', async (req, res) => {
    try {
        const [[transport]] = await db.query(`
            SELECT t.*, s.service_name, s.availability_status, s.operating_hours
            FROM Transport t
            JOIN Service s ON t.transport_id = s.service_id
            WHERE t.transport_id = ?
        `, [req.params.transport_id]);

        if (!transport) {
            return res.status(404).json({ error: 'Transport service not found' });
        }

        const [schedules] = await db.query(`
            SELECT ts.*, r.start_point, r.end_point, r.distance_km
            FROM Transport_Schedule ts
            JOIN Route r ON ts.route_id = r.route_id
            WHERE ts.transport_id = ?
            ORDER BY ts.start_time
        `, [req.params.transport_id]);

        transport.schedules = schedules;
        res.json(transport);
    } catch (err) {
        console.error('Transport detail error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create transport
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const { transport_id, mode } = req.body;
    try {
        await db.query(
            "INSERT INTO Transport (transport_id, mode) VALUES (?, ?)",
            [transport_id, mode]
        );
        res.json({ message: "Transport created successfully", transport_id });
    } catch (err) {
        console.error('Error creating transport:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update transport
router.put('/:transport_id', async (req, res) => {
    res.send(`Update transport ${req.params.transport_id}`);
});

// Delete transport
router.delete('/:transport_id', async (req, res) => {
    res.send(`Delete transport ${req.params.transport_id}`);
});

module.exports = router;
