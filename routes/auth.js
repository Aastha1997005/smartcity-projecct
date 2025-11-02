const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Register user
router.post("/register", async (req, res) => {
  const { username: email, password, role } = req.body;
  if (role && role.toLowerCase() === 'admin') {
    return res.status(403).json({ error: 'Cannot register as admin.' });
  }
  const isEmail = v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const allowedRoles = ['citizen','transport','waste_management','public_lights','water','electricity','internet','healthcare','utility'];
  if (!isEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!role || !allowedRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    // Check if user already exists
    const [existing] = await db.query("SELECT * FROM Users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "You are already registered" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO Users (email, password_hash, role, linked_id) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, role, null]
    );
    // If the registrant supplied provider details (for department/provider roles), create provider and mappings
    try {
      // fetch the created user id
      const [[urow]] = await db.query('SELECT user_id FROM Users WHERE email = ? LIMIT 1', [email]);
      const userId = urow ? urow.user_id : null;

      // Special-case healthcare: create a Service + Healthcare (hospital) record and link the user
      if (role === 'healthcare' && (req.body.hospital_name || req.body.provider_name)) {
        const hospitalName = req.body.hospital_name || req.body.provider_name;
        const serviceName = req.body.service_name || hospitalName;
        const cost = req.body.cost || 0;
        const availability_status = req.body.availability_status || 'Active';
        const operating_hours = req.body.operating_hours || '24/7';

        const [svcRes] = await db.query(
          'INSERT INTO Service (service_name, cost, availability_status, operating_hours) VALUES (?, ?, ?, ?)',
          [serviceName, cost, availability_status, operating_hours]
        );
        const hospitalId = svcRes.insertId;

        // Create Healthcare record referencing the service as hospital
        const capacity = req.body.capacity || null;
        const type = req.body.hospital_type || null;
        await db.query('INSERT INTO Healthcare (hospital_id, name, capacity, type) VALUES (?, ?, ?, ?)', [hospitalId, hospitalName, capacity, type]);

        // Link the user to the healthcare hospital id
        if (userId) {
          await db.query('UPDATE Users SET linked_id = ? WHERE user_id = ?', [hospitalId, userId]);
        }
      }
      // Special-case internet providers: create Service -> Utility -> Internet and link user
      else if (role === 'internet' && (req.body.provider_name || req.body.bandwidth || req.body.coverage_area)) {
        const providerName = req.body.provider_name || req.body.service_name || req.body.email || 'Internet Provider';
        const serviceName = req.body.service_name || providerName;
        const cost = req.body.cost || req.body.cost_per_month || 0;
        const availability_status = req.body.availability_status || 'Active';
        const operating_hours = req.body.operating_hours || '24/7';

        const [svcRes2] = await db.query('INSERT INTO Service (service_name, cost, availability_status, operating_hours) VALUES (?, ?, ?, ?)', [serviceName, cost, availability_status, operating_hours]);
        const serviceId2 = svcRes2.insertId;

        // Create a Utility row referencing the service (utility_id = service_id)
        try {
          await db.query('INSERT INTO Utility (utility_id) VALUES (?)', [serviceId2]);
        } catch (e) {
          // if Utility has additional required columns, try a safer insert with NULLs
          try { await db.query('INSERT INTO Utility (utility_id, unit, issue_date) VALUES (?, ?, ?)', [serviceId2, req.body.unit || null, req.body.issue_date || null]); } catch (ee) { console.error('Utility insert during internet register failed', ee.message); }
        }

        // Insert Internet-specific row
        try {
          await db.query('INSERT INTO Internet (internet_id, provider_name, bandwidth, coverage_area, cost_per_month, service_type) VALUES (?, ?, ?, ?, ?, ?)', [serviceId2, providerName, req.body.bandwidth || null, req.body.coverage_area || null, req.body.cost_per_month || req.body.cost || null, req.body.service_type || null]);
        } catch (e) {
          console.error('Internet insert failed during register:', e.message);
        }

        // Link the user to the service (consistent with healthcare linking to service_id)
        if (userId) {
          await db.query('UPDATE Users SET linked_id = ? WHERE user_id = ?', [serviceId2, userId]);
        }
      }
      // Only proceed for non-citizen roles when provider info is supplied
      else if (role && role !== 'citizen' && req.body.provider_name && req.body.service_type) {
        const { provider_name, service_type, contact_no } = req.body;
        const [provRes] = await db.query(
          'INSERT INTO Service_Provider (name, service_type, contact_no) VALUES (?, ?, ?)',
          [provider_name, service_type, contact_no || null]
        );
        const providerId = provRes.insertId;

        // Link the user to the new provider profile
        if (userId) {
          await db.query('UPDATE Users SET linked_id = ? WHERE user_id = ?', [providerId, userId]);
        }

        // services_offered: optional array of service_id numbers
        if (Array.isArray(req.body.services_offered) && req.body.services_offered.length) {
          const values = req.body.services_offered.map(sid => [sid, providerId]);
          // Use INSERT IGNORE to avoid duplicates
          await db.query('INSERT IGNORE INTO Service_To_Provider (service_id, provider_id) VALUES ?', [values]);
        }

        // service_category_map: optional array of objects { service_id, category_name }
        if (Array.isArray(req.body.service_category_map) && req.body.service_category_map.length) {
          for (const m of req.body.service_category_map) {
            const sid = m.service_id;
            const cname = (m.category_name || '').trim();
            if (!sid || !cname) continue;
            // ensure category exists
            const [catRows] = await db.query('SELECT category_id FROM Service_Category WHERE name = ? LIMIT 1', [cname]);
            let categoryId;
            if (catRows && catRows.length) {
              categoryId = catRows[0].category_id;
            } else {
              const [insCat] = await db.query('INSERT INTO Service_Category (name, description) VALUES (?, ?) ', [cname, null]);
              categoryId = insCat.insertId;
            }
            // insert mapping (service -> category)
            await db.query('INSERT IGNORE INTO Service_Category_Map (service_id, category_id) VALUES (?, ?)', [sid, categoryId]);
          }
        }
      }
    } catch (innerErr) {
      // Non-fatal: log but do not fail registration
      console.error('Provider creation during register failed:', innerErr);
    }

    res.json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
// Complete profile endpoint
router.post("/complete-profile", async (req, res) => {
  const { email, role } = req.body;

  // Basic validators
  const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isName = (v) => typeof v === 'string' && /^[A-Za-z ]{2,}$/.test(v);
  const isPincode = (v) => typeof v === 'string' && /^\d{6}$/.test(v);
  const isPhone = (v) => typeof v === 'string' && /^\d{10}$/.test(v);
  const isValidDOB = (v) => {
    if (!v) return false;
    const d = new Date(v);
    return !isNaN(d) && d < new Date();
  };

   
  if (!isEmail(email)) return res.status(400).json({ error: 'Invalid or missing email' });
  if (!role) return res.status(400).json({ error: 'Missing role' });

  try {
    // Find user
    const [users] = await db.query("SELECT * FROM Users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = users[0];
    let linked_id = null;

    if (role === 'citizen') {
      const { first_name, last_name, street, area, city, pincode, gender, dob, house_id } = req.body;
      if (!isName(first_name) || !isName(last_name)) return res.status(400).json({ error: 'Invalid name' });
      if (!area || !city) return res.status(400).json({ error: 'Area and city are required' });
      if (!isPincode(pincode)) return res.status(400).json({ error: 'Pincode must be 6 digits' });
      if (!isValidDOB(dob)) return res.status(400).json({ error: 'Invalid date of birth' });
      const houseIdVal = (house_id === '' || house_id === undefined) ? null : house_id;
      const [result] = await db.query(
        `INSERT INTO Citizen (first_name, last_name, street, area, city, pincode, gender, dob, house_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [first_name, last_name, street, area, city, pincode, gender, dob, houseIdVal]
      );
      linked_id = result.insertId;

    } else if (role === 'healthcare') {
      // Create a Service entry and Healthcare (hospital) row, then add service-level phones/emails
      const { hospital_name, service_name, capacity, hospital_type, contact_no, phones, email, emails, availability_status, operating_hours, cost } = req.body;
      const hospitalName = hospital_name || req.body.provider_name || null;
      if (!hospitalName) return res.status(400).json({ error: 'Hospital/facility name required' });
      const svcName = service_name || hospitalName;
      const svcCost = (typeof cost !== 'undefined' && cost !== '') ? cost : 0;
      const avail = availability_status || 'Active';
      const hours = operating_hours || '24/7';

      const [svcRes] = await db.query('INSERT INTO Service (service_name, cost, availability_status, operating_hours) VALUES (?, ?, ?, ?)', [svcName, svcCost, avail, hours]);
      const hospitalId = svcRes.insertId;
      await db.query('INSERT INTO Healthcare (hospital_id, name, capacity, type) VALUES (?, ?, ?, ?)', [hospitalId, hospitalName, capacity || null, hospital_type || null]);

      // Insert phones: accept either `phones` (array or comma string) or `contact_no`
      try {
        const phoneList = [];
        if (Array.isArray(phones)) phoneList.push(...phones);
        else if (typeof phones === 'string' && phones.trim()) phoneList.push(...phones.split(',').map(s => s.trim()).filter(Boolean));
        else if (contact_no) phoneList.push(contact_no);
        for (const p of phoneList) {
          if (!p) continue;
          await db.query('INSERT IGNORE INTO Service_Phone_Number (service_id, phone_number) VALUES (?, ?)', [hospitalId, p]);
        }
      } catch (e) {
        console.error('phones insert error', e.message);
      }

      // Insert emails: accept `emails` (array or comma string) or `email`
      try {
        const emailList = [];
        if (Array.isArray(emails)) emailList.push(...emails);
        else if (typeof emails === 'string' && emails.trim()) emailList.push(...emails.split(',').map(s => s.trim()).filter(Boolean));
        else if (email) emailList.push(email);
        for (const em of emailList) {
          if (!em) continue;
          await db.query('INSERT IGNORE INTO Service_Emails (service_id, email) VALUES (?, ?)', [hospitalId, em]);
        }
      } catch (e) {
        console.error('emails insert error', e.message);
      }

      linked_id = hospitalId;

    } else if (['transport','utility','internet'].includes(role)) {
      // Create Service_Provider and optional Service_To_Provider mappings
      const { provider_name, service_type, contact_no, phones, email, emails, services_offered } = req.body;
      if (!provider_name || !service_type) return res.status(400).json({ error: 'provider_name and service_type required' });
      const [provRes] = await db.query('INSERT INTO Service_Provider (name, service_type, contact_no) VALUES (?, ?, ?)', [provider_name, service_type, contact_no || null]);
      const providerId = provRes.insertId;
      linked_id = providerId;

      // If services_offered provided (array of service_id), create mapping rows
      try {
        if (Array.isArray(services_offered) && services_offered.length) {
          const values = services_offered.map(sid => [sid, providerId]);
          await db.query('INSERT IGNORE INTO Service_To_Provider (service_id, provider_id) VALUES ?', [values]);
        }
      } catch (e) {
        console.error('service mapping error', e.message);
      }

      // Optionally attach service-level phones/emails to listed services (if services_offered present)
      try {
        const phoneList = [];
        if (Array.isArray(phones)) phoneList.push(...phones);
        else if (typeof phones === 'string' && phones.trim()) phoneList.push(...phones.split(',').map(s => s.trim()).filter(Boolean));
        else if (contact_no) phoneList.push(contact_no);
        const emailList = [];
        if (Array.isArray(emails)) emailList.push(...emails);
        else if (typeof emails === 'string' && emails.trim()) emailList.push(...emails.split(',').map(s => s.trim()).filter(Boolean));
        else if (email) emailList.push(email);
        if (Array.isArray(services_offered) && services_offered.length) {
          for (const sid of services_offered) {
            for (const p of phoneList) {
              await db.query('INSERT IGNORE INTO Service_Phone_Number (service_id, phone_number) VALUES (?, ?)', [sid, p]);
            }
            for (const em of emailList) {
              await db.query('INSERT IGNORE INTO Service_Emails (service_id, email) VALUES (?, ?)', [sid, em]);
            }
          }
        }
      } catch (e) {
        console.error('provider phones/emails attach error', e.message);
      }

    } else {
      return res.status(400).json({ error: 'Unsupported role for profile completion' });
    }

    // Update user with correct linked_id (profile id)
    await db.query("UPDATE Users SET linked_id = ? WHERE user_id = ?", [linked_id, user.user_id]);
    res.json({ message: "Profile completed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
});

// Login
router.post("/login", async (req, res) => {
  const { username: email, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM Users WHERE email = ?", [
      email,
    ]);
    if (rows.length === 0)
      return res.status(400).json({ error: "User not found" });

    const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      "your_jwt_secret",
      { expiresIn: "1h" }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Change password (for logged-in users)
const { authenticateToken } = require("../middleware/auth");
router.put("/change-password", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new password required' });
  }
  try {
    // Get current password hash
    const [rows] = await db.query('SELECT password_hash FROM Users WHERE user_id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Old password incorrect' });
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE Users SET password_hash = ? WHERE user_id = ?', [newHash, userId]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;