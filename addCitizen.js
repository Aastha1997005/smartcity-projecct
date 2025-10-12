const db = require('./db');
const bcrypt = require('bcrypt');

async function addCitizens() {
  const citizens = [
    { email: 'priya.sharma@example.com', password: 'password123', linked_id: 1 },
    { email: 'amit.singh@example.com', password: 'password123', linked_id: 2 },
    { email: 'sonia.verma@example.com', password: 'password123', linked_id: 3 },
    { email: 'rajesh.kumar@example.com', password: 'password123', linked_id: 4 },
  ];
  const role = 'citizen';
  try {
    for (const citizen of citizens) {
      const hashedPassword = await bcrypt.hash(citizen.password, 10);
      await db.query(
        'INSERT INTO Users (email, password_hash, role, linked_id) VALUES (?, ?, ?, ?)',
        [citizen.email, hashedPassword, role, citizen.linked_id]
      );
      console.log(`Citizen user ${citizen.email} created successfully!`);
    }
  } catch (err) {
    console.error('Error creating citizen user:', err.message);
  } finally {
    process.exit();
  }
}

addCitizens();
