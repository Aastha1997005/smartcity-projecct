
const express = require('express');
const router = express.Router();
const db = require('../db'); // promise-based pool
const { authenticateToken } = require('../middleware/auth');

// GET current user's profile (citizen/healthcare/transport) using JWT
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    try {
        const [users] = await db.query('SELECT role, linked_id FROM Users WHERE user_id = ?', [userId]);
        if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
        const role = users[0].role;
        const linkedId = users[0].linked_id;
        // If linked_id is not set, return minimal user info and a flag so the frontend
        // can prompt the user to complete their profile rather than receiving a hard 400.
        if (!linkedId) {
            const [[userRow]] = await db.query('SELECT user_id, email, role, created_at FROM Users WHERE user_id = ?', [userId]);
            return res.json({ needs_profile: true, user: userRow });
        }

            if (role === 'citizen') {
                const [rows] = await db.query('SELECT c.* FROM Users u JOIN Citizen c ON u.linked_id = c.citizen_id WHERE u.user_id = ? AND u.role = "citizen"', [userId]);
                if (!rows || rows.length === 0) return res.status(404).json({ error: 'Citizen profile not found' });
                const profile = rows[0];
                // Fetch email from Users table
                const [[userRow]] = await db.query('SELECT email FROM Users WHERE user_id = ?', [userId]);
                if (userRow && userRow.email) profile.email = userRow.email;
                // Fetch phone numbers from Citizen_Phone_Number
                const [phones] = await db.query('SELECT phone_number FROM Citizen_Phone_Number WHERE citizen_id = ?', [profile.citizen_id]);
                profile.phones = phones.map(p => p.phone_number);
                // For backward compatibility set phone as first phone or existing phone field
                profile.phone = profile.phones.length ? profile.phones[0] : profile.phone || null;
                return res.json(profile);
            }

        // If the user is a healthcare account, return the hospital/Healthcare profile
        if (role === 'healthcare') {
            // Return enriched hospital profile: Healthcare row, linked Service (if any), listed doctors and contact phones/emails
            const [[hRow]] = await db.query('SELECT h.* FROM Users u JOIN Healthcare h ON u.linked_id = h.hospital_id WHERE u.user_id = ? AND u.role = "healthcare"', [userId]);
            if (!hRow) return res.status(404).json({ error: 'Healthcare profile not found' });

            // If there is a Service record with service_id == hospital_id (legacy), fetch it
            let service = null;
            try {
                const [[svc]] = await db.query('SELECT * FROM Service WHERE service_id = ? LIMIT 1', [hRow.hospital_id]);
                if (svc) service = svc;
            } catch (e) {
                // ignore
            }

            // Fetch doctors working in this hospital, include optional capacity/type if present on Doctors table
            let doctors = [];
            try {
                const [cols] = await db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Doctors' AND COLUMN_NAME IN ('capacity','type')");
                const colNames = (cols || []).map(c => c.COLUMN_NAME.toLowerCase());
                const selectCols = ['d.doctor_id', 'd.name', 'd.specialisation'];
                if (colNames.includes('capacity')) selectCols.push('d.capacity');
                if (colNames.includes('type')) selectCols.push('d.type');
                const sql = `SELECT ${selectCols.join(', ')} FROM works_in w JOIN Doctors d ON w.doctor_id = d.doctor_id WHERE w.hospital_id = ?`;
                const [docRows] = await db.query(sql, [hRow.hospital_id]);
                doctors = docRows || [];
            } catch (e) {
                // ignore if schema introspection fails
                try {
                    const [docRows] = await db.query('SELECT d.* FROM works_in w JOIN Doctors d ON w.doctor_id = d.doctor_id WHERE w.hospital_id = ?', [hRow.hospital_id]);
                    doctors = docRows || [];
                } catch (ee) { /* ignore */ }
            }

            // Aggregate provider contact info if Service_Provider/Service_Phone_No exists for this hospital
            let contacts = { phones: [], emails: [] };
            try {
                const [phones] = await db.query('SELECT phone_number FROM Service_Phone_Number WHERE service_id = ?', [hRow.hospital_id]);
                contacts.phones = phones.map(p => p.phone_number);
            } catch (e) {}
            try {
                const [emails] = await db.query('SELECT email FROM Service_Emails WHERE service_id = ?', [hRow.hospital_id]);
                contacts.emails = emails.map(e => e.email);
            } catch (e) {}

            const profile = { hospital: hRow, service, doctors, contacts };
            return res.json(profile);
        }
    // For department roles (transport, waste_management, public_lights, water, electricity, internet, healthcare)
    // return minimal user info; department users may have separate profile tables in future.
    const departmentRoles = ['transport','waste_management','public_lights','water','electricity','internet','healthcare'];
        if (departmentRoles.includes(role)) {
            const [[userRow]] = await db.query('SELECT email, role, linked_id, created_at FROM Users WHERE user_id = ?', [userId]);
            return res.json(userRow);
        }

        res.status(400).json({ error: 'Unsupported role' });
    } catch (err) {
        console.error('Profile route error:', err);
        res.status(500).json({ error: 'Server error loading profile' });
    }
});

// Generic helper to update a profile table by linked_id and fields
async function patchProfileByRole(userId, roleTable, idField, updates) {
    // Resolve linked_id for the user. For Service_Provider, we only require the linked_id
    // and will map provider.service_type to a logical role when needed.
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [userId]);
    if (!users || users.length === 0) throw { status: 404, message: 'User not found' };
    const profileId = users[0].linked_id;
    if (!profileId) throw { status: 400, message: 'Profile incomplete' };
    if (!profileId) throw { status: 400, message: 'Profile incomplete' };
    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    if (!fields) throw { status: 400, message: 'No fields to update' };
    const values = Object.values(updates);
    await db.query(`UPDATE ${roleTable.toLowerCase()} SET ${fields} WHERE ${idField} = ?`, [...values, profileId]);
}

// PATCH profile partial endpoints
router.patch('/citizen/:user_id', async (req, res) => {
    try {
        await patchProfileByRole(req.params.user_id, 'Citizen', 'citizen_id', req.body);
        res.json({ message: 'Profile updated (partial)' });
    } catch (err) {
        if (err && err.status) return res.status(err.status).json({ error: err.message });
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.patch('/hospital/:user_id', async (req, res) => {
    try {
        await patchProfileByRole(req.params.user_id, 'Healthcare', 'hospital_id', req.body);
        res.json({ message: 'Profile updated (partial)' });
    } catch (err) {
        if (err && err.status) return res.status(err.status).json({ error: err.message });
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.patch('/provider/:user_id', async (req, res) => {
    try {
        await patchProfileByRole(req.params.user_id, 'Service_Provider', 'provider_id', req.body);
        res.json({ message: 'Profile updated (partial)' });
    } catch (err) {
        if (err && err.status) return res.status(err.status).json({ error: err.message });
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get specific role profiles
router.get('/citizen/:user_id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT c.* FROM Users u JOIN Citizen c ON u.linked_id = c.citizen_id WHERE u.user_id = ? AND u.role = "citizen"', [req.params.user_id]);
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/citizen/:user_id', async (req, res) => {
    try {
        const { name, address, phone } = req.body;
        const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ? AND role = "citizen"', [req.params.user_id]);
        if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
        const citizenId = users[0].linked_id;
        await db.query('UPDATE Citizen SET name = ?, address = ?, phone = ? WHERE citizen_id = ?', [name, address, phone, citizenId]);
        res.json({ message: 'Profile updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/hospital/:user_id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT h.* FROM Users u JOIN Healthcare h ON u.linked_id = h.hospital_id WHERE u.user_id = ? AND u.role = "healthcare"', [req.params.user_id]);
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/hospital/:user_id', async (req, res) => {
    try {
        const { name, capacity, type, phones, emails, service_name } = req.body;
        const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ? AND role = "healthcare"', [req.params.user_id]);
        if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
        const hospitalId = users[0].linked_id;

        // Update Healthcare table
        const fields = [];
        const vals = [];
        if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
        if (capacity !== undefined) { fields.push('capacity = ?'); vals.push(capacity); }
        if (type !== undefined) { fields.push('type = ?'); vals.push(type); }
        if (fields.length) {
            await db.query(`UPDATE Healthcare SET ${fields.join(', ')} WHERE hospital_id = ?`, [...vals, hospitalId]);
        }

        // If a linked Service exists (service_id == hospitalId), update its service_name if provided
        if (service_name !== undefined) {
            try {
                await db.query('UPDATE Service SET service_name = ? WHERE service_id = ?', [service_name, hospitalId]);
            } catch (e) { /* ignore */ }
        }

        // Replace phone and email contacts if arrays provided
        if (Array.isArray(phones)) {
                try {
                    await db.query('DELETE FROM Service_Phone_Number WHERE service_id = ?', [hospitalId]);
                    for (const p of phones) {
                        if (!p) continue;
                        await db.query('INSERT INTO Service_Phone_Number (service_id, phone_number) VALUES (?, ?)', [hospitalId, p]);
                    }
                } catch (e) { /* ignore */ }
        }
        if (Array.isArray(emails)) {
            try {
                    await db.query('DELETE FROM Service_Emails WHERE service_id = ?', [hospitalId]);
                    for (const em of emails) {
                        if (!em) continue;
                        await db.query('INSERT INTO Service_Emails (service_id, email) VALUES (?, ?)', [hospitalId, em]);
                    }
            } catch (e) { /* ignore */ }
        }

        res.json({ message: 'Profile updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/provider/:user_id', async (req, res) => {
    try {
    // Resolve the linked provider id from Users and return provider profile with derived department role
    const [[userRow]] = await db.query('SELECT linked_id FROM Users WHERE user_id = ?', [req.params.user_id]);
    if (!userRow || !userRow.linked_id) return res.status(404).json({ error: 'User or linked provider not found' });
    const providerId = userRow.linked_id;
    const [rows] = await db.query('SELECT p.* FROM Service_Provider p WHERE p.provider_id = ?', [providerId]);
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
        const profile = rows[0];
        // Derive department role from service_type
        const st = (profile.service_type || '').toLowerCase();
        let derivedRole = 'transport';
        if (st.includes('transport')) derivedRole = 'transport';
        else if (st.includes('water') || st.includes('utility')) derivedRole = 'utility';
        else if (st.includes('health') || st.includes('hospital')) derivedRole = 'healthcare';
        else if (st.includes('internet') || st.includes('telecom')) derivedRole = 'internet';
        profile.derived_role = derivedRole;
        res.json(profile);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/provider/:user_id', async (req, res) => {
    try {
        const { name, service_type, phone } = req.body;
    const [users] = await db.query('SELECT linked_id FROM Users WHERE user_id = ? AND role = "transport"', [req.params.user_id]);
        if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
        const providerId = users[0].linked_id;
        await db.query('UPDATE Service_Provider SET name = ?, service_type = ?, phone = ? WHERE provider_id = ?', [name, service_type, phone, providerId]);
        res.json({ message: 'Profile updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
