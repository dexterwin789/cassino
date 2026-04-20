require('dotenv').config();
const { query, pool } = require('../src/config/database');

(async () => {
  const r = await query(
    `SELECT id, username, email, name FROM users
     WHERE email ILIKE '%karlos%' OR username ILIKE '%karlos%'
     ORDER BY id`
  );
  console.log('Users matching karlos:');
  console.table(r.rows);
  const max = await query('SELECT MAX(id) AS mx, COUNT(*) AS c FROM users');
  console.log('Total users:', max.rows[0]);
  await pool.end();
})();
