const express = require("express");
const router = express.Router();
const {db} = require("../db");
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Helper: fetch providers (with phones/emails) mapped to a service
async function fetchProvidersForService(serviceId) {
  if (!serviceId) return [];
  try {
    // Use GROUP_CONCAT to aggregate phones/emails per provider
    const [provRows] = await db.query(
  `SELECT p.provider_id, p.name AS provider_name, p.service_type,
      GROUP_CONCAT(DISTINCT spn.phone_number) AS phones,
      GROUP_CONCAT(DISTINCT se.email) AS emails
   FROM Service_To_Provider stp
   JOIN Service_Provider p ON stp.provider_id = p.provider_id
   LEFT JOIN Service_Phone_Number spn ON stp.service_id = spn.service_id
   LEFT JOIN Service_Emails se ON stp.service_id = se.service_id
   WHERE stp.service_id = ?
   GROUP BY p.provider_id`,
  [serviceId]
    );
    if (provRows && provRows.length) {
      return provRows.map(r => ({
        provider_id: r.provider_id,
        name: r.provider_name,
        service_type: r.service_type,
        phones: r.phones ? r.phones.split(',') : [],
        emails: r.emails ? r.emails.split(',') : []
      }));
    }

    // If no explicit mapping, but Service.provider_id exists, try that
    const [[s]] = await db.query('SELECT provider_id FROM Service WHERE service_id = ? LIMIT 1', [serviceId]);
    if (s && s.provider_id) {
      // Get provider info and attach service-level contacts for this serviceId (preferred)
      const [rows] = await db.query(
        `SELECT p.provider_id, p.name AS provider_name, p.service_type,
                 (SELECT GROUP_CONCAT(DISTINCT phone_number) FROM Service_Phone_Number WHERE service_id = ?) AS phones,
                 (SELECT GROUP_CONCAT(DISTINCT email) FROM Service_Emails WHERE service_id = ?) AS emails
         FROM Service_Provider p
         WHERE p.provider_id = ?`,
        [serviceId, serviceId, s.provider_id]
      );
      if (rows && rows.length) {
        return rows.map(r => ({
          provider_id: r.provider_id,
          name: r.provider_name,
          service_type: r.service_type,
          phones: r.phones ? r.phones.split(',') : (r.contact_no ? [r.contact_no] : []),
          emails: r.emails ? r.emails.split(',') : []
        }));
      }
    }

    return [];
  } catch (err) {
    // If mapping tables don't exist or any error occurs, gracefully return empty array
    return [];
  }
}

// Get all service bookings for a specific user (includes service info for frontend grouping)
router.get('/bookings/user/:user_id', async (req, res) => {
  const userId = req.params.user_id;
  try {
    const [rows] = await db.query(
      `SELECT b.*, s.service_name, s.cost, s.availability_status, s.operating_hours, b.service_name_cache, b.service_category_cache, b.provider_id
       FROM Service_Booking b
       LEFT JOIN Service s ON b.service_id = s.service_id
       WHERE b.citizen_id = ?
       ORDER BY b.booking_start DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get bookings grouped by category for a user (convenience for frontend My Services)
router.get('/bookings/user/:user_id/grouped', async (req, res) => {
  const userId = req.params.user_id;
  try {
    const [rows] = await db.query(
      `SELECT b.booking_id, b.citizen_id, b.service_id, b.booking_start, b.booking_end, b.status, b.priority, b.details,
              COALESCE(b.service_name_cache, s.service_name) AS service_name,
              COALESCE(b.service_category_cache, '') AS category_name,
              b.provider_id
       FROM Service_Booking b
       LEFT JOIN Service s ON b.service_id = s.service_id
       WHERE b.citizen_id = ?
       ORDER BY b.booking_start DESC`,
      [userId]
    );

    // Group by category_name
    const grouped = {};
    for (const r of rows) {
      const cat = r.category_name || 'uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(r);
    }
    res.json(grouped);
  } catch (err) {
    console.error('Grouped bookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a booking (authenticated) with overlap validation and cache autofill
router.post('/bookings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    let { citizen_id, service_id, booking_start, booking_end, details, priority } = req.body;
    if (!citizen_id || !service_id || !booking_start) return res.status(400).json({ error: 'Missing required fields' });

    // normalize booking_end: if not provided, treat as same instant
    if (!booking_end) booking_end = booking_start;

    // Overlap check: prevent overlapping bookings for the same citizen
    const overlapSql = `SELECT COUNT(*) AS cnt FROM Service_Booking WHERE citizen_id = ? AND status IN ('upcoming','scheduled','in_progress')
      AND NOT (booking_end <= ? OR booking_start >= ?)`;
    const [ov] = await db.query(overlapSql, [citizen_id, booking_start, booking_end]);
    if (ov && ov.length && ov[0].cnt > 0) {
      return res.status(409).json({ error: 'Overlapping booking exists for this citizen' });
    }

    // Overlap check: prevent overlapping bookings for the same service (capacity constraint)
    const overlapServiceSql = `SELECT COUNT(*) AS cnt FROM Service_Booking WHERE service_id = ? AND status IN ('upcoming','scheduled','in_progress')
      AND NOT (booking_end <= ? OR booking_start >= ?)`;
    const [ovSvc] = await db.query(overlapServiceSql, [service_id, booking_start, booking_end]);
    if (ovSvc && ovSvc.length && ovSvc[0].cnt > 0) {
      return res.status(409).json({ error: 'Service is already booked for the requested time slot' });
    }

    const [result] = await db.query(
      'INSERT INTO Service_Booking (citizen_id, service_id, booking_start, booking_end, details, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [citizen_id, service_id, booking_start, booking_end || null, JSON.stringify(details || {}), priority || 'medium', userId || null]
    );

    const bookingId = result.insertId;

    // Autofill caches: service_name_cache, provider_id (use mapping tables first), service_category_cache
    const [[serviceRow]] = await db.query('SELECT service_name FROM Service WHERE service_id = ?', [service_id]);
    const svcName = serviceRow ? serviceRow.service_name : null;

    // Use explicit mappings if present
    const providers = await fetchProvidersForService(service_id);
    const providerId = providers && providers.length ? providers[0].provider_id : null;

    // Determine category: prefer explicit Service_Category_Map then fallback to heuristics
    let category = null;
    try {
      const [catRows] = await db.query(
        `SELECT sc.name FROM Service_Category_Map scm JOIN Service_Category sc ON scm.category_id = sc.category_id WHERE scm.service_id = ? LIMIT 1`,
        [service_id]
      );
      if (catRows && catRows.length) category = catRows[0].name;
    } catch (e) {
      // table may not exist, ignore
    }
    if (!category && svcName) {
      const s = svcName.toLowerCase();
    // normalize for variants like 'broad band' or 'broad-band'
    const sNorm = s.replace(/[^a-z0-9]/g, '');
    if (s.includes('water') || s.includes('pipeline') || s.includes('sewage')) category = 'water';
  else if (s.includes('elect') || s.includes('power') || s.includes('meter')) category = 'electricity';
  else if (s.includes('internet') || s.includes('wifi') || s.includes('telecom') || s.includes('broadband') || s.includes('broad-band') || sNorm.includes('broadband')) category = 'internet';
      else if (s.includes('transport') || s.includes('bus') || s.includes('taxi') || s.includes('rail')) category = 'transport';
      else if (s.includes('waste') || s.includes('garbage') || s.includes('sanitation')) category = 'waste';
      else if (s.includes('health') || s.includes('clinic') || s.includes('doctor') || s.includes('hospital')) category = 'healthcare';
    }

    await db.query('UPDATE Service_Booking SET provider_id = ?, service_name_cache = ?, service_category_cache = ? WHERE booking_id = ?', [providerId, svcName, category, bookingId]);

    res.json({ booking_id: bookingId });
  } catch (err) {
    console.error('Booking create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update booking (status/assignment/reschedule)
router.put('/bookings/:booking_id', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    if (!fields) return res.status(400).json({ error: 'No fields to update' });
    const values = Object.values(updates);
    await db.query(`UPDATE Service_Booking SET ${fields}, updated_at = NOW() WHERE booking_id = ?`, [...values, booking_id]);

    // If booking_start/booking_end or service_id updated, enforce per-service overlap check
    if (updates.booking_start || updates.booking_end || updates.service_id) {
      const [[curr]] = await db.query('SELECT service_id, booking_start, booking_end FROM Service_Booking WHERE booking_id = ?', [booking_id]);
      const svc = curr.service_id;
      const start = updates.booking_start || curr.booking_start;
      const end = updates.booking_end || curr.booking_end || start;
      const [ovSvc] = await db.query(`SELECT COUNT(*) AS cnt FROM Service_Booking WHERE service_id = ? AND booking_id != ? AND status IN ('upcoming','scheduled','in_progress') AND NOT (booking_end <= ? OR booking_start >= ?)`, [svc, booking_id, start, end]);
      if (ovSvc && ovSvc.length && ovSvc[0].cnt > 0) {
        return res.status(409).json({ error: 'Service is already booked for the requested time slot' });
      }
    }

    // If service_id or booking times changed, refresh caches
    if (updates.service_id || updates.booking_start || updates.booking_end) {
      // fetch current service_id
      const [[row]] = await db.query('SELECT service_id FROM Service_Booking WHERE booking_id = ?', [booking_id]);
      const svcId = row ? row.service_id : null;
      if (svcId) {
        const [[serviceRow]] = await db.query('SELECT service_name FROM Service WHERE service_id = ?', [svcId]);
        const svcName = serviceRow ? serviceRow.service_name : null;
  // Try to resolve providers via mapping tables first
  const providers = await fetchProvidersForService(svcId);
  const providerId = providers && providers.length ? providers[0].provider_id : null;
        let category = null;
        try {
          const [catRows] = await db.query(
            `SELECT sc.name FROM Service_Category_Map scm JOIN Service_Category sc ON scm.category_id = sc.category_id WHERE scm.service_id = ? LIMIT 1`,
            [svcId]
          );
          if (catRows && catRows.length) category = catRows[0].name;
        } catch (e) {
          // ignore
        }
        if (!category && svcName) {
          const s = svcName.toLowerCase();
          const sNorm = s.replace(/[^a-z0-9]/g, '');
          if (s.includes('water') || s.includes('pipeline') || s.includes('sewage')) category = 'water';
            else if (s.includes('elect') || s.includes('power') || s.includes('meter')) category = 'electricity';
            else if (s.includes('internet') || s.includes('wifi') || s.includes('telecom') || s.includes('broadband') || s.includes('broad-band') || sNorm.includes('broadband')) category = 'internet';
          else if (s.includes('transport') || s.includes('bus') || s.includes('taxi') || s.includes('rail')) category = 'transport';
          else if (s.includes('waste') || s.includes('garbage') || s.includes('sanitation')) category = 'waste';
          else if (s.includes('health') || s.includes('clinic') || s.includes('doctor') || s.includes('hospital')) category = 'healthcare';
        }
        await db.query('UPDATE Service_Booking SET provider_id = ?, service_name_cache = ?, service_category_cache = ? WHERE booking_id = ?', [providerId, svcName, category, booking_id]);
      }
    }
    res.json({ message: 'Updated' });
  } catch (err) {
    console.error('Booking update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Analytics/statistics endpoint for services
router.get("/usage", async (req, res) => {
  try {
    const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM Service");
    const [statusCounts] = await db.query("SELECT availability_status, COUNT(*) as count FROM Service GROUP BY availability_status");
    res.json({ total, statusCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List available service categories (from Service_Category if exists, otherwise heuristics)
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT category_id, name, description FROM Service_Category ORDER BY name');
    if (rows && rows.length) return res.json(rows);
  } catch (e) {
    // table may not exist, fall back
  }
  // Fallback categories
  res.json([
    { name: 'water', description: 'Water supply and distribution services' },
    { name: 'electricity', description: 'Power generation and distribution services' },
    { name: 'internet', description: 'Internet and telecom services' },
    { name: 'transport', description: 'Public transport and related services' },
    { name: 'waste', description: 'Waste collection and management services' },
    { name: 'healthcare', description: 'Healthcare and medical services' }
  ]);
});

// Get services grouped by category for frontend service selection
router.get('/grouped', async (req, res) => {
  try {
    // Try to use explicit category mapping first
    const [mapped] = await db.query(
    `SELECT sc.name AS category_name, s.service_id, s.service_name, s.cost, s.availability_status, s.operating_hours, s.provider_id, p.name AS provider_name
       FROM Service s
       JOIN Service_Category_Map scm ON s.service_id = scm.service_id
       JOIN Service_Category sc ON scm.category_id = sc.category_id
       LEFT JOIN Service_Provider p ON s.provider_id = p.provider_id
       ORDER BY sc.name, s.service_name`
    );
    if (mapped && mapped.length) {
      const grouped = {};
      for (const r of mapped) {
        const cat = r.category_name;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(r);
      }
      return res.json(grouped);
    }

    // Fallback: heuristic grouping by service_name
    const [rows] = await db.query('SELECT s.*, p.name AS provider_name FROM Service s LEFT JOIN Service_Provider p ON s.provider_id = p.provider_id ORDER BY s.service_name');
    const grouped = {};
    for (const s of rows) {
      let cat = 'uncategorized';
    const n = (s.service_name || '').toLowerCase();
    const nNorm = n.replace(/[^a-z0-9]/g, '');
    if (n.includes('water') || n.includes('pipeline') || n.includes('sewage')) cat = 'water';
    else if (n.includes('elect') || n.includes('power') || n.includes('meter')) cat = 'electricity';
  else if (n.includes('internet') || n.includes('wifi') || n.includes('telecom') || n.includes('broadband') || n.includes('broad-band') || nNorm.includes('broadband')) cat = 'internet';
      else if (n.includes('transport') || n.includes('bus') || n.includes('taxi') || n.includes('rail')) cat = 'transport';
      else if (n.includes('waste') || n.includes('garbage') || n.includes('sanitation')) cat = 'waste';
      else if (n.includes('health') || n.includes('clinic') || n.includes('doctor') || n.includes('hospital')) cat = 'healthcare';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }
    res.json(grouped);
  } catch (err) {
    console.error('Grouped services error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Service detail including mapped providers and their contact info
router.get('/:service_id', async (req, res) => {
  const { service_id } = req.params;
  try {
    const [[svc]] = await db.query('SELECT * FROM Service WHERE service_id = ? LIMIT 1', [service_id]);
    if (!svc) return res.status(404).json({ error: 'Not found' });
    const providers = await fetchProvidersForService(service_id);
    res.json({ service: svc, providers });
  } catch (err) {
    console.error('Service detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Internet-specific service detail
router.get('/internet/:service_id', async (req, res) => {
  const { service_id } = req.params;
  try {
    const [[svc]] = await db.query('SELECT * FROM Service WHERE service_id = ? LIMIT 1', [service_id]);
    if (!svc) return res.status(404).json({ error: 'Not found' });

    // Try to fetch Internet specific row if table exists
    let internetRow = null;
    try {
      const [ir] = await db.query('SELECT * FROM Internet WHERE internet_id = ? LIMIT 1', [service_id]);
      if (ir && ir.length) internetRow = ir[0];
    } catch (e) {
      // table might not exist, ignore
    }

    // Fetch service-level phones/emails (preferred canonical)
    let phones = [];
    let emails = [];
    try {
      const [[p]] = await db.query('SELECT GROUP_CONCAT(DISTINCT phone_number) AS phones FROM Service_Phone_Number WHERE service_id = ?', [service_id]);
      const [[e]] = await db.query('SELECT GROUP_CONCAT(DISTINCT email) AS emails FROM Service_Emails WHERE service_id = ?', [service_id]);
      phones = p && p.phones ? p.phones.split(',') : [];
      emails = e && e.emails ? e.emails.split(',') : [];
    } catch (e) {
      // ignore if tables missing
    }

    const providers = await fetchProvidersForService(service_id);

    // Recent bookings for this service
    let bookings = [];
    try {
      const [brows] = await db.query(
        `SELECT b.booking_id, b.citizen_id, b.booking_start, b.booking_end, b.status, b.details, b.priority, b.provider_id, b.service_name_cache, b.service_category_cache, b.created_at,
                c.first_name AS citizen_first_name, c.last_name AS citizen_last_name, u.email AS citizen_email,
                sp.name AS provider_name
         FROM Service_Booking b
         LEFT JOIN Citizen c ON b.citizen_id = c.citizen_id
         LEFT JOIN Users u ON u.linked_id = c.citizen_id
         LEFT JOIN Service_Provider sp ON b.provider_id = sp.provider_id
         WHERE b.service_id = ?
         ORDER BY b.booking_start DESC LIMIT 50`,
        [service_id]
      );
      bookings = brows;
    } catch (e) {
      // ignore
    }

    res.json({ service: svc, internet: internetRow, phones, emails, providers, bookings });
  } catch (err) {
    console.error('Internet service detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
// Search services by name or ID
router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing search query" });
  const sql = `SELECT * FROM Service WHERE service_name LIKE ? OR service_id = ?`;
  const likeQ = `%${q}%`;
  try {
    const [rows] = await db.query(sql, [likeQ, q]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



  // Admin: set provider_id on a Service (explicit mapping)
  router.post('/set-provider', authenticateToken, async (req, res) => {
    try {
      const { service_id, provider_id } = req.body;
      if (!service_id) return res.status(400).json({ error: 'Missing service_id' });
      await db.query('UPDATE Service SET provider_id = ? WHERE service_id = ?', [provider_id || null, service_id]);
      res.json({ message: 'Provider set' });
    } catch (err) {
      console.error('Set provider error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

// Admin: map a service to a provider (upsert into Service_To_Provider)
router.post('/map/service-provider', authenticateToken, async (req, res) => {
  try {
    const { service_id, provider_id } = req.body;
    if (!service_id || !provider_id) return res.status(400).json({ error: 'Missing fields' });
    await db.query('INSERT INTO Service_To_Provider (service_id, provider_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE provider_id = VALUES(provider_id)', [service_id, provider_id]);
    res.json({ message: 'Mapped' });
  } catch (err) {
    console.error('Map error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: map a service to a category (upsert into Service_Category_Map)
router.post('/map/service-category', authenticateToken, async (req, res) => {
  try {
    const { service_id, category_id } = req.body;
    if (!service_id || !category_id) return res.status(400).json({ error: 'Missing fields' });
    await db.query('INSERT INTO Service_Category_Map (service_id, category_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE category_id = VALUES(category_id)', [service_id, category_id]);
    res.json({ message: 'Mapped' });
  } catch (err) {
    console.error('Map error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Pagination, filtering, and sorting for services
router.get("/", async (req, res) => {
  const { availability_status, page = 1, limit = 10, sort_by = "service_id", order = "asc" } = req.query;
  let sql = "SELECT * FROM Service";
  const params = [];
  if (availability_status) {
    sql += " WHERE availability_status = ?";
    params.push(availability_status);
  }
  // Sorting
  sql += ` ORDER BY ${sort_by} ${order.toUpperCase() === "DESC" ? "DESC" : "ASC"}`;
  // Pagination
  sql += " LIMIT ? OFFSET ?";
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new service
router.post("/", authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const {
    service_name,
    cost,
    availability_status,
    operating_hours
  } = req.body;

  try {
    await db.query(
      `INSERT INTO Service (service_name, cost, availability_status, operating_hours)
      VALUES (?, ?, ?, ?)`,
      [service_name, cost, availability_status, operating_hours]
    );
    res.json({ message: "Service added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
