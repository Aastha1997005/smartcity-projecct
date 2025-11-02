const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * HEALTHCARE PAGE ROUTES
 * Complete hospital details including:
 * - Hospital information (name, capacity, type)
 * - All doctors working at the hospital (name, specialization)
 * - Contact information (phones, emails)
 * - Service bookings and appointments
 * - Operating hours and availability
 */

// Get all healthcare facilities with complete details
router.get("/", async (req, res) => {
  try {
    const [hospitals] = await db.query(`
      SELECT h.*, s.service_name, s.cost, s.availability_status, s.operating_hours
      FROM Healthcare h
      LEFT JOIN Service s ON h.hospital_id = s.service_id
      ORDER BY h.hospital_id
    `);
    
    // Fetch doctors and contacts for each hospital
    for (let hospital of hospitals) {
      // Get doctors
      const [doctors] = await db.query(`
        SELECT d.doctor_id, d.name, d.specialization
        FROM works_in w
        JOIN Doctors d ON w.doctor_id = d.doctor_id
        WHERE w.hospital_id = ?
      `, [hospital.hospital_id]);
      
      // Get contact phones
      const [phones] = await db.query(`
        SELECT phone_number
        FROM Service_Phone_Number
        WHERE service_id = ?
      `, [hospital.hospital_id]);
      
      // Get contact emails
      const [emails] = await db.query(`
        SELECT email
        FROM Service_Emails
        WHERE service_id = ?
      `, [hospital.hospital_id]);
      
      hospital.doctors = doctors;
      hospital.contact_phones = phones.map(p => p.phone_number);
      hospital.contact_emails = emails.map(e => e.email);
      hospital.doctor_count = doctors.length;
    }
    
    res.json(hospitals);
  } catch (err) {
    console.error('Healthcare list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get detailed information for a specific hospital
router.get("/:hospital_id", async (req, res) => {
  try {
    const hospitalId = req.params.hospital_id;
    
    // Get hospital basic info
    const [[hospital]] = await db.query(`
      SELECT h.*, s.service_name, s.cost, s.availability_status, s.operating_hours, s.provider_id
      FROM Healthcare h
      LEFT JOIN Service s ON h.hospital_id = s.service_id
      WHERE h.hospital_id = ?
    `, [hospitalId]);
    
    if (!hospital) {
      return res.status(404).json({ error: "Healthcare facility not found" });
    }
    
    // Get all doctors with their specializations
    const [doctors] = await db.query(`
      SELECT d.doctor_id, d.name, d.specialization
      FROM works_in w
      JOIN Doctors d ON w.doctor_id = d.doctor_id
      WHERE w.hospital_id = ?
      ORDER BY d.specialization, d.name
    `, [hospitalId]);
    
    // Get contact information
    const [phones] = await db.query(
      'SELECT phone_number FROM Service_Phone_Number WHERE service_id = ?',
      [hospitalId]
    );
    
    const [emails] = await db.query(
      'SELECT email FROM Service_Emails WHERE service_id = ?',
      [hospitalId]
    );
    
    // Get recent bookings/appointments
    const [bookings] = await db.query(`
      SELECT b.booking_id, b.booking_start, b.booking_end, b.status, b.details,
             CONCAT(c.first_name, ' ', c.last_name) as patient_name,
             c.citizen_id
      FROM Service_Booking b
      JOIN Citizen c ON b.citizen_id = c.citizen_id
      WHERE b.service_id = ?
      ORDER BY b.booking_start DESC
      LIMIT 50
    `, [hospitalId]);
    
    // Group doctors by specialization
    const doctorsBySpecialization = {};
    doctors.forEach(doc => {
      const spec = doc.specialization || 'General';
      if (!doctorsBySpecialization[spec]) {
        doctorsBySpecialization[spec] = [];
      }
      doctorsBySpecialization[spec].push(doc);
    });
    
    res.json({
      hospital,
      doctors,
      doctorsBySpecialization,
      contacts: {
        phones: phones.map(p => p.phone_number),
        emails: emails.map(e => e.email)
      },
      recentBookings: bookings,
      statistics: {
        totalDoctors: doctors.length,
        specializations: Object.keys(doctorsBySpecialization).length,
        capacity: hospital.capacity,
        type: hospital.type
      }
    });
  } catch (err) {
    console.error('Hospital detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all doctors in a hospital (dedicated endpoint)
router.get("/:hospital_id/doctors", async (req, res) => {
  try {
    const [doctors] = await db.query(`
      SELECT d.doctor_id, d.name, d.specialization
      FROM works_in w
      JOIN Doctors d ON w.doctor_id = d.doctor_id
      WHERE w.hospital_id = ?
      ORDER BY d.specialization, d.name
    `, [req.params.hospital_id]);
    
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new healthcare facility (admin or healthcare role)
router.post("/", authenticateToken, authorizeRoles('admin', 'healthcare'), async (req, res) => {
  const { name, capacity, type, service_name, cost, availability_status, operating_hours, phones, emails } = req.body;
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // Create Service record first
    const [serviceResult] = await connection.query(
      "INSERT INTO Service (service_name, cost, availability_status, operating_hours) VALUES (?, ?, ?, ?)",
      [service_name || name, cost || 0, availability_status || 'Active', operating_hours || '24/7']
    );
    
    const hospitalId = serviceResult.insertId;
    
    // Create Healthcare record
    await connection.query(
      "INSERT INTO Healthcare (hospital_id, name, capacity, type) VALUES (?, ?, ?, ?)",
      [hospitalId, name, capacity, type]
    );
    
    // Add phone numbers if provided
    if (phones && Array.isArray(phones)) {
      for (const phone of phones) {
        await connection.query(
          'INSERT INTO Service_Phone_Number (service_id, phone_number) VALUES (?, ?)',
          [hospitalId, phone]
        );
      }
    }
    
    // Add emails if provided
    if (emails && Array.isArray(emails)) {
      for (const email of emails) {
        await connection.query(
          'INSERT INTO Service_Emails (service_id, email) VALUES (?, ?)',
          [hospitalId, email]
        );
      }
    }
    
    await connection.commit();
    res.json({ message: "Healthcare facility created successfully", hospital_id: hospitalId });
  } catch (err) {
    await connection.rollback();
    console.error('Healthcare creation error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Update healthcare facility
router.put("/:hospital_id", authenticateToken, authorizeRoles('admin', 'healthcare'), async (req, res) => {
  const { name, capacity, type, service_name, cost, availability_status, operating_hours } = req.body;
  
  try {
    // Update Healthcare table
    if (name || capacity || type) {
      const updates = [];
      const params = [];
      
      if (name) { updates.push('name = ?'); params.push(name); }
      if (capacity) { updates.push('capacity = ?'); params.push(capacity); }
      if (type) { updates.push('type = ?'); params.push(type); }
      
      if (updates.length > 0) {
        params.push(req.params.hospital_id);
        await db.query(
          `UPDATE Healthcare SET ${updates.join(', ')} WHERE hospital_id = ?`,
          params
        );
      }
    }
    
    // Update Service table
    if (service_name || cost || availability_status || operating_hours) {
      const updates = [];
      const params = [];
      
      if (service_name) { updates.push('service_name = ?'); params.push(service_name); }
      if (cost !== undefined) { updates.push('cost = ?'); params.push(cost); }
      if (availability_status) { updates.push('availability_status = ?'); params.push(availability_status); }
      if (operating_hours) { updates.push('operating_hours = ?'); params.push(operating_hours); }
      
      if (updates.length > 0) {
        params.push(req.params.hospital_id);
        await db.query(
          `UPDATE Service SET ${updates.join(', ')} WHERE service_id = ?`,
          params
        );
      }
    }
    
    res.json({ message: "Healthcare facility updated successfully" });
  } catch (err) {
    console.error('Healthcare update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add a doctor to hospital
router.post("/:hospital_id/doctors", authenticateToken, authorizeRoles('admin', 'healthcare'), async (req, res) => {
  const { doctor_id, name, specialization } = req.body;
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    let doctorIdToUse = doctor_id;
    
    // If doctor doesn't exist, create new doctor
    if (!doctor_id && name && specialization) {
      const [result] = await connection.query(
        'INSERT INTO Doctors (name, specialization) VALUES (?, ?)',
        [name, specialization]
      );
      doctorIdToUse = result.insertId;
    }
    
    // Link doctor to hospital
    await connection.query(
      "INSERT INTO works_in (doctor_id, hospital_id) VALUES (?, ?)",
      [doctorIdToUse, req.params.hospital_id]
    );
    
    await connection.commit();
    res.json({ message: "Doctor added to hospital successfully", doctor_id: doctorIdToUse });
  } catch (err) {
    await connection.rollback();
    console.error('Add doctor error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Remove doctor from hospital
router.delete("/:hospital_id/doctors/:doctor_id", authenticateToken, authorizeRoles('admin', 'healthcare'), async (req, res) => {
  try {
    await db.query(
      "DELETE FROM works_in WHERE doctor_id = ? AND hospital_id = ?",
      [req.params.doctor_id, req.params.hospital_id]
    );
    res.json({ message: "Doctor removed from hospital" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get appointments/bookings for a hospital
router.get("/:hospital_id/appointments", async (req, res) => {
  try {
    const { status, from_date, to_date } = req.query;
    
    let sql = `
      SELECT b.booking_id, b.booking_start, b.booking_end, b.status, b.priority, b.details,
             CONCAT(c.first_name, ' ', c.last_name) as patient_name,
             c.citizen_id, c.area, c.city
      FROM Service_Booking b
      JOIN Citizen c ON b.citizen_id = c.citizen_id
      WHERE b.service_id = ?
    `;
    const params = [req.params.hospital_id];
    
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    if (from_date) {
      sql += ' AND b.booking_start >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND b.booking_start <= ?';
      params.push(to_date);
    }
    
    sql += ' ORDER BY b.booking_start DESC';
    
    const [appointments] = await db.query(sql, params);
    res.json(appointments);
  } catch (err) {
    console.error('Appointments fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Book an appointment at hospital (citizen)
router.post("/:hospital_id/appointments", authenticateToken, async (req, res) => {
  try {
    const { citizen_id, booking_start, booking_end, details, priority } = req.body;
    
    if (!citizen_id || !booking_start) {
      return res.status(400).json({ error: 'citizen_id and booking_start are required' });
    }
    
    const [result] = await db.query(
      `INSERT INTO Service_Booking (citizen_id, service_id, booking_start, booking_end, details, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, 'upcoming')`,
      [citizen_id, req.params.hospital_id, booking_start, booking_end || booking_start, JSON.stringify(details || {}), priority || 'medium']
    );
    
    res.json({ message: 'Appointment booked successfully', booking_id: result.insertId });
  } catch (err) {
    console.error('Appointment booking error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete healthcare facility (admin only)
router.delete("/:hospital_id", authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    await db.query("DELETE FROM Healthcare WHERE hospital_id = ?", [req.params.hospital_id]);
    res.json({ message: "Healthcare facility deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search doctors across all hospitals
router.get("/search/doctors", async (req, res) => {
  try {
    const { name, specialization } = req.query;
    
    let sql = `
      SELECT d.*, h.name as hospital_name, h.hospital_id
      FROM Doctors d
      JOIN works_in w ON d.doctor_id = w.doctor_id
      JOIN Healthcare h ON w.hospital_id = h.hospital_id
      WHERE 1=1
    `;
    const params = [];
    
    if (name) {
      sql += ' AND d.name LIKE ?';
      params.push(`%${name}%`);
    }
    if (specialization) {
      sql += ' AND d.specialization LIKE ?';
      params.push(`%${specialization}%`);
    }
    
    sql += ' ORDER BY d.name';
    
    const [doctors] = await db.query(sql, params);
    res.json(doctors);
  } catch (err) {
    console.error('Doctor search error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;