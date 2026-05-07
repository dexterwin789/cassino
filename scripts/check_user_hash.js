// Inspect password_hash for affected accounts
(async () => {
  const { pool } = require('../src/config/database');
  try {
    const r = await pool.query(`
      SELECT id, username, email,
             length(password_hash) AS hash_len,
             LEFT(password_hash, 7) AS hash_prefix,
             cpf, created_at, updated_at
        FROM users
       WHERE LOWER(email) = 'karlosenrique368@gmail.com'
          OR username ILIKE '%karlos%'
       ORDER BY id DESC
       LIMIT 20
    `);
    console.log('Karlos rows:', JSON.stringify(r.rows, null, 2));

    const totals = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE password_hash IS NULL OR password_hash = '') AS empty_hash,
        COUNT(*) FILTER (WHERE password_hash IS NOT NULL AND length(password_hash) <> 60) AS bad_len,
        COUNT(*) FILTER (WHERE password_hash IS NOT NULL AND LEFT(password_hash,4) NOT IN ('$2a$','$2b$','$2y$')) AS bad_prefix,
        COUNT(*) AS total
        FROM users
    `);
    console.log('Health:', totals.rows[0]);

    const dups = await pool.query(`
      SELECT LOWER(email) AS email, COUNT(*) AS n
        FROM users
       WHERE email IS NOT NULL AND email <> ''
       GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC
       LIMIT 20
    `);
    console.log('Duplicate emails:', dups.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
