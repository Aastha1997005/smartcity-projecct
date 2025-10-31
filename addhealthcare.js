const db = require('./db');
const bcrypt = require('bcrypt');

async function addHealthcare() {
  const hospitals = [
    { email: 'apexHospital@example.com', password: 'password123', linked_id: 4 },
   
  ];
  const role = 'healthcare';
  try {
    for (const hospital of hospitals) {
      const hashedPassword = await bcrypt.hash(hospital.password, 10);
      await db.query(
        'INSERT INTO Users (email, password_hash, role, linked_id) VALUES (?, ?, ?, ?)',
        [hospital.email, hashedPassword, role, hospital.linked_id]
      );
      console.log(`Hospital user ${hospital.email} created successfully!`);
    }
  } catch (err) {
    console.error('Error creating hospital user:', err.message);
  } finally {
    process.exit();
  }
}

addHealthcare();