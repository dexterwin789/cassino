// Recria user 24 (karlos araujo) + seeds completos + conta de teste 'testseed'
// Rodar: node scripts/seed_user24_and_test.js
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const URL = 'postgresql://postgres:CMxeFqOjCBbFjpBxtWMZrrUuBsjndwXI@roundhouse.proxy.rlwy.net:57858/railway';

async function seedUser(db, userId, label, gameId) {
  console.log(`\n--- SEED ${label} (id=${userId}) ---`);

  // limpa dados antigos do user pra ficar idempotente
  await db.query('DELETE FROM bets WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM withdrawals WHERE user_id=$1', [userId]);
  await db.query("DELETE FROM transactions WHERE user_id=$1 AND provider_ref LIKE 'seed-%'", [userId]);
  await db.query('DELETE FROM users WHERE referred_by=$1 AND username LIKE $2', [userId, `lead_${userId}_%`]);

  // 5 apostas cassino (hoje, vários horários)
  for (let i = 0; i < 5; i++) {
    const amount = 500 + i * 250;
    const payout = i % 2 === 0 ? amount * 2 : 0;
    const status = payout > 0 ? 'won' : 'lost';
    await db.query(
      `INSERT INTO bets (user_id, game_id, amount_cents, payout_cents, multiplier, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6, NOW() - ($7 || ' minutes')::interval)`,
      [userId, gameId, amount, payout, payout > 0 ? 2 : 0, status, i * 13]
    );
  }

  // 3 apostas esportivas (game_id NULL, hoje)
  for (let i = 0; i < 3; i++) {
    const amount = 1000 + i * 500;
    const payout = i === 0 ? amount * 3 : 0;
    const status = payout > 0 ? 'won' : 'lost';
    await db.query(
      `INSERT INTO bets (user_id, game_id, amount_cents, payout_cents, multiplier, status, created_at)
       VALUES ($1, NULL, $2, $3, $4, $5, NOW() - ($6 || ' hours')::interval)`,
      [userId, amount, payout, payout > 0 ? 3 : 0, status, i]
    );
  }

  // 3 depósitos pagos (3 dias distribuídos)
  for (let i = 0; i < 3; i++) {
    await db.query(
      `INSERT INTO transactions (user_id, type, status, amount_cents, provider, provider_ref, created_at)
       VALUES ($1,'deposit','paid',$2,'blackcat',$3, NOW() - ($4 || ' days')::interval)`,
      [userId, 5000 + i * 2500, `seed-${userId}-${i}-${Date.now()}`, i]
    );
  }

  // 1 saque pendente (hoje)
  await db.query(
    `INSERT INTO withdrawals (user_id, amount_cents, pix_type, pix_key, status, created_at)
     VALUES ($1, 3000, 'cpf', '000.000.000-00', 'pending', NOW() - INTERVAL '6 hours')`,
    [userId]
  );

  // 2 leads referidos
  const suffix = Date.now().toString().slice(-6);
  const hash = await bcrypt.hash('lead123', 10);
  for (let i = 0; i < 2; i++) {
    const lusername = `lead_${userId}_${suffix}${i}`;
    const r = await db.query(
      `INSERT INTO users (username, name, phone, password_hash, referred_by, created_at)
       VALUES ($1,$2,$3,$4,$5, NOW() - ($6 || ' days')::interval)
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      [lusername, `Lead ${i + 1} de ${label}`, `1199000${suffix}${i}`, hash, userId, i]
    );
    if (r.rows[0]) {
      const leadId = r.rows[0].id;
      await db.query(
        `INSERT INTO transactions (user_id, type, status, amount_cents, provider, provider_ref)
         VALUES ($1,'deposit','paid',$2,'blackcat',$3)`,
        [leadId, 10000 * (i + 1), `seed-lead-${leadId}`]
      );
      await db.query(
        `INSERT INTO bets (user_id, game_id, amount_cents, status) VALUES ($1,$2,500,'lost')`,
        [leadId, gameId]
      );
    }
  }
}

(async () => {
  const db = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // garante um game
  let g = await db.query("SELECT id FROM games ORDER BY id LIMIT 1");
  let gameId = g.rows[0]?.id;
  if (!gameId) {
    const ins = await db.query(
      "INSERT INTO games (game_code, game_name, provider, category) VALUES ('fortune-tiger','Fortune Tiger','pg','slots') RETURNING id"
    );
    gameId = ins.rows[0].id;
  }
  console.log('game_id =', gameId);

  // ---- USER 24: recria se faltar ----
  const pwd24 = await bcrypt.hash('Karlos@123', 10);
  const exists24 = await db.query('SELECT id FROM users WHERE id=24');
  if (exists24.rows.length === 0) {
    console.log('[INFO] user 24 nao existe — recriando como karlos_araujo');
    // remove username/cpf conflitantes primeiro
    await db.query("DELETE FROM users WHERE username='karlos_araujo' OR cpf='240.000.000-24'");
    await db.query(
      `INSERT INTO users (id, username, name, phone, email, cpf, password_hash, balance, bonus, is_active)
       VALUES (24,'karlos_araujo','karlos araujo','11988888888','karlos@teste.com','240.000.000-24',$1,100.00,0,TRUE)`,
      [pwd24]
    );
    await db.query(`INSERT INTO wallets (user_id, balance_cents) VALUES (24, 10000) ON CONFLICT DO NOTHING`);
    // avanca sequence se preciso
    await db.query(`SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 24))`);
  } else {
    console.log('[INFO] user 24 ja existe');
  }

  await seedUser(db, 24, 'user 24 (karlos_araujo)', gameId);

  // ---- testseed ----
  const pwdTest = await bcrypt.hash('teste123', 10);
  const tr = await db.query(
    `INSERT INTO users (username, name, phone, cpf, password_hash, balance, is_active)
     VALUES ('testseed','Teste Seed','11777777777','111.222.333-44',$1,200.00,TRUE)
     ON CONFLICT (username) DO UPDATE SET name=EXCLUDED.name
     RETURNING id`,
    [pwdTest]
  );
  const testId = tr.rows[0].id;
  await db.query(`INSERT INTO wallets (user_id, balance_cents) VALUES ($1, 20000) ON CONFLICT DO NOTHING`, [testId]);

  await seedUser(db, testId, 'testseed', gameId);

  // ---- VERIFICAÇÃO ----
  console.log('\n=== CONTAGENS FINAIS ===');
  for (const id of [24, testId]) {
    const r = await db.query(`
      SELECT
        (SELECT username FROM users WHERE id=$1) AS username,
        $1::int AS id,
        (SELECT COUNT(*) FROM bets WHERE user_id=$1 AND game_id IS NOT NULL) AS casino,
        (SELECT COUNT(*) FROM bets WHERE user_id=$1 AND game_id IS NULL) AS sport,
        (SELECT COUNT(*) FROM transactions WHERE user_id=$1) AS txs,
        (SELECT COUNT(*) FROM withdrawals WHERE user_id=$1) AS wds,
        (SELECT COUNT(*) FROM users WHERE referred_by=$1) AS leads
    `, [id]);
    console.table(r.rows);
  }

  console.log('\n✅ CREDENCIAIS:');
  console.log('   karlos_araujo / Karlos@123  (id=24)');
  console.log('   testseed      / teste123    (id=' + testId + ')');
  await db.end();
})().catch(err => { console.error('ERRO:', err); process.exit(1); });
