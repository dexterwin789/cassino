require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('./database');

async function migrate() {
  console.log('[MIGRATE] Running schema...');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  try {
    await pool.query(sql);
    console.log('[MIGRATE] Schema applied.');

    // Generate proper admin hash
    const hash = await bcrypt.hash('Admin@12345', 10);
    await pool.query(
      `UPDATE admin_users SET password_hash = $1 WHERE username = 'admin'`,
      [hash]
    );
    console.log('[MIGRATE] Admin password hash updated.');

    console.log('[MIGRATE] Done!');
  } catch (err) {
    console.error('[MIGRATE] Error:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
