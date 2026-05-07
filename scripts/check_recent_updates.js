(async () => {
  const { pool } = require('../src/config/database');
  try {
    const recent = await pool.query(`
      SELECT id, username, email, created_at, updated_at,
             EXTRACT(EPOCH FROM (updated_at - created_at)) AS age_diff_sec
        FROM users
       WHERE updated_at > NOW() - INTERVAL '30 days'
         AND updated_at > created_at
       ORDER BY updated_at DESC
       LIMIT 30
    `);
    console.log('Recently updated users (last 30d):');
    recent.rows.forEach(r => console.log(`  id=${r.id} ${r.email} created=${r.created_at.toISOString()} updated=${r.updated_at.toISOString()}`));

    // Check if there's a password reset audit table
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND (table_name ILIKE '%password%' OR table_name ILIKE '%audit%' OR table_name ILIKE '%login%')
    `);
    console.log('\nAudit-ish tables:', tables.rows);
  } catch (e) { console.error(e); } finally { process.exit(0); }
})();
