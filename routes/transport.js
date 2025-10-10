const express = require('express');
const router = express.Router();

// Get all transport options
router.get('/', async (req, res) => {
    res.send('Get all transport options');
});

// Get transport by ID
router.get('/:transport_id', async (req, res) => {
    res.send(`Get transport ${req.params.transport_id}`);
});

// Create transport
router.post('/', async (req, res) => {
    res.send('Create transport');
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
