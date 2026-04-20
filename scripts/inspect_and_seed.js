// Inspeciona usuário 24, semeia dados, cria conta de teste (testseed) com mesmos dados
// Rodar com: node scripts/inspect_and_seed.js
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const URL = process.env.DATABASE_URL ||
  'postgresql://postgres:CMxeFqOjCBbFjpBxtWMZrrUuBsjndwXI@roundhouse.proxy.rlwy.net:57858/railway';

(async () => {
  const db = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const SELF_ID = 24;

  // ---- 1) ESTADO ATUAL ----
  console.log('\n=== ESTADO ATUAL DO USUÁRIO 24 ===');
  const u24 = await db.query('SELECT id, username, name, referred_by, created_at FROM users WHERE id=$1', [SELF_ID]);
  console.log('user:', u24.rows[0]);

  const counts24 = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM bets WHERE user_id=$1 AND game_id IS NOT NULL) AS casino_bets,
      (SELECT COUNT(*) FROM bets WHERE user_id=$1 AND game_id IS NULL) AS sport_bets,
      (SELECT COUNT(*) FROM transactions WHERE user_id=$1) AS txs,
      (SELECT COUNT(*) FROM withdrawals WHERE user_id=$1) AS wds,
      (SELECT COUNT(*) FROM users WHERE referred_by=$1) AS leads
  `, [SELF_ID]);
  console.log('contagens:', counts24.rows[0]);

  // ---- 2) GARANTIR que há ao menos 1 game para foreign key ----
  let gameRow = await db.query("SELECT id FROM games ORDER BY id LIMIT 1");
  let gameId;
  if (gameRow.rows.length === 0) {
    const ins = await db.query(
      "INSERT INTO games (game_code, game_name, provider, category) VALUES ('fortune-tiger','Fortune Tiger','pg','slots') RETURNING id"
    );
    gameId = ins.rows[0].id;
    console.log('criou game id=', gameId);
  } else {
    gameId = gameRow.rows[0].id;
  }

  // ---- 3) FUNÇÃO DE SEED ----
  async function seedUser(userId, label) {
    console.log(`\n=== SEEDING ${label} (id=${userId}) ===`);

    // 5 apostas de cassino (hoje)
    for (let i = 0; i < 5; i++) {
      const amount = 500 + i * 250;
      const payout = i % 2 === 0 ? amount * 2 : 0;
      const status = payout > 0 ? 'won' : 'lost';
      await db.query(
        `INSERT INTO bets (user_id, game_id, amount_cents, payout_cents, multiplier, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6, NOW() - ($7 || ' minutes')::interval)`,
        [userId, gameId, amount, payout, payout > 0 ? 2 : 0, status, i * 7]
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

    // 3 depósitos pagos
    for (let i = 0; i < 3; i++) {
      await db.query(
        `INSERT INTO transactions (user_id, type, status, amount_cents, provider, provider_ref, created_at)
         VALUES ($1,'deposit','paid',$2,'blackcat',$3, NOW() - ($4 || ' days')::interval)`,
        [userId, 5000 + i * 2500, 'seed-' + userId + '-' + i + '-' + Date.now(), i]
      );
    }

    // 1 saque solicitado
    await db.query(
      `INSERT INTO withdrawals (user_id, amount_cents, pix_type, pix_key, status, created_at)
       VALUES ($1, 3000, 'cpf', '000.000.000-00', 'pending', NOW() - INTERVAL '6 hours')`,
      [userId]
    );

    // 2 leads (usuários referred_by = userId)
    const suffix = Date.now().toString().slice(-8);
    for (let i = 0; i < 2; i++) {
      const lusername = `lead_${userId}_${suffix}_${i}`;
      const r = await db.query(
        `INSERT INTO users (username, name, phone, cpf, password_hash, referred_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6, NOW() - ($7 || ' days')::interval)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        [lusername, 'Lead ' + i, '119900000' + i + userId, `000.000.00${i}-${userId}`, 'x', userId, i]
      );
      if (r.rows[0]) {
        const leadId = r.rows[0].id;
        // dá um depósito pago pro lead (aparece deposited_cents na query)
        await db.query(
          `INSERT INTO transactions (user_id, type, status, amount_cents, provider, provider_ref)
           VALUES ($1,'deposit','paid',$2,'blackcat',$3)`,
          [leadId, 10000 * (i + 1), 'seed-lead-' + leadId]
        );
        // e 1 aposta
        await db.query(
          `INSERT INTO bets (user_id, game_id, amount_cents, status) VALUES ($1,$2,500,'lost')`,
          [leadId, gameId]
        );
      }
    }
    console.log('OK.');
  }

  await seedUser(SELF_ID, 'USER 24');

  // ---- 4) CRIAR CONTA TESTE ----
  console.log('\n=== CRIANDO CONTA testseed ===');
  const pwd = await bcrypt.hash('teste123', 10);
  const testR = await db.query(
    `INSERT INTO users (username, name, phone, cpf, password_hash, balance, bonus, is_active)
     VALUES ('testseed','Teste Seed','11999990000','999.888.777-66',$1,100.00,0.00,TRUE)
     ON CONFLICT (username) DO UPDATE SET name=EXCLUDED.name
     RETURNING id`,
    [pwd]
  );
  const testId = testR.rows[0].id;
  console.log('testseed id=', testId);

  // limpar seeds antigas dessa conta para re-rodar idempotente
  await db.query('DELETE FROM bets WHERE user_id=$1', [testId]);
  await db.query('DELETE FROM withdrawals WHERE user_id=$1', [testId]);
  await db.query('DELETE FROM transactions WHERE user_id=$1', [testId]);

  await seedUser(testId, 'TESTSEED');

  // ---- 5) VERIFICAÇÃO FINAL ----
  console.log('\n=== CONTAGENS FINAIS ===');
  for (const id of [SELF_ID, testId]) {
    const r = await db.query(`
      SELECT
        $1::int AS user_id,
        (SELECT COUNT(*) FROM bets WHERE user_id=$1 AND game_id IS NOT NULL) AS casino_bets,
        (SELECT COUNT(*) FROM bets WHERE user_id=$1 AND game_id IS NULL) AS sport_bets,
        (SELECT COUNT(*) FROM transactions WHERE user_id=$1) AS txs,
        (SELECT COUNT(*) FROM withdrawals WHERE user_id=$1) AS wds,
        (SELECT COUNT(*) FROM users WHERE referred_by=$1) AS leads
    `, [id]);
    console.log(r.rows[0]);
  }

  console.log('\n>>> testseed / teste123 (id=' + testId + ')');
  await db.end();
})().catch(err => { console.error('ERRO:', err); process.exit(1); });
