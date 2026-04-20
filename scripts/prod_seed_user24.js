// Seed prod DB: balance, leads, transactions for user 24 (karlosenrique367@gmail.com)
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const URL = 'postgresql://postgres:FSSRyVSBeEIjJNkmHTspwcGbuQyGoEdj@interchange.proxy.rlwy.net:11184/railway';

(async () => {
  const db = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // 1) Saldo R$5.000 + bônus R$500 para user 24 e 22
  for (const uid of [22, 24]) {
    await db.query(`UPDATE users SET balance=5000.00, bonus=500.00, updated_at=NOW() WHERE id=$1`, [uid]);
    await db.query(`INSERT INTO wallets (user_id, balance_cents, updated_at) VALUES ($1, 500000, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET balance_cents=500000, updated_at=NOW()`, [uid]);
  }

  // 2) Leads (2 usuários indicados por 24)
  const hash = await bcrypt.hash('Teste@123', 10);
  const leadsData = [
    { email: 'lead_ana@test.com',   cpf: '22233344455', name: 'Ana Lead',   phone: '11988001122' },
    { email: 'lead_bruno@test.com', cpf: '33344455566', name: 'Bruno Lead', phone: '21977002233' }
  ];
  for (const L of leadsData) {
    const exist = await db.query(`SELECT id FROM users WHERE email=$1`, [L.email]);
    let leadId;
    if (exist.rows.length) {
      leadId = exist.rows[0].id;
      await db.query(`UPDATE users SET referred_by=24, name=$2, cpf=$3, phone=$4 WHERE id=$1`, [leadId, L.name, L.cpf, L.phone]);
    } else {
      const ins = await db.query(
        `INSERT INTO users (username,email,cpf,phone,password_hash,name,is_active,referred_by,created_at,updated_at)
         VALUES ($1,$1,$2,$3,$4,$5,true,24, NOW() - INTERVAL '3 days', NOW()) RETURNING id`,
        [L.email, L.cpf, L.phone, hash, L.name]
      );
      leadId = ins.rows[0].id;
    }
    // depósito do lead
    await db.query(`INSERT INTO transactions (user_id,type,status,amount_cents,provider,created_at,updated_at)
                    VALUES ($1,'deposit','paid',5000,'blackcat', NOW() - INTERVAL '2 days', NOW())
                    ON CONFLICT DO NOTHING`, [leadId]);
    // 1 aposta
    await db.query(`INSERT INTO bets (user_id,game_id,amount_cents,payout_cents,multiplier,status,created_at)
                    VALUES ($1,1,1000,1500,1.5,'won', NOW() - INTERVAL '1 day')`, [leadId]);
    console.log(`lead: ${L.email} id=${leadId}`);
  }

  // 3) Mais transações para user 24 (extrato rico)
  const now = new Date();
  const txs = [
    { type: 'deposit',  status: 'paid',    amount: 10000, prov: 'blackcat', daysAgo: 5 },
    { type: 'deposit',  status: 'paid',    amount: 5000,  prov: 'pix',      daysAgo: 3 },
    { type: 'bonus',    status: 'paid',    amount: 2500,  prov: 'system',   daysAgo: 2 },
    { type: 'deposit',  status: 'pending', amount: 3000,  prov: 'pix',      daysAgo: 0 }
  ];
  for (const t of txs) {
    await db.query(`INSERT INTO transactions (user_id,type,status,amount_cents,provider,created_at,updated_at)
                    VALUES (24,$1,$2,$3,$4, NOW() - ($5::int || ' days')::interval, NOW())`,
                   [t.type, t.status, t.amount, t.prov, t.daysAgo]);
  }

  // 4) 1 saque
  await db.query(`INSERT INTO withdrawals (user_id,amount_cents,pix_type,pix_key,status,created_at,updated_at)
                  VALUES (24,2000,'cpf','14485052400','pending', NOW() - INTERVAL '1 day', NOW())`);

  // 5) Resumo final
  const u = await db.query(`SELECT id, email, balance, bonus FROM users WHERE id=24`);
  const w = await db.query(`SELECT balance_cents FROM wallets WHERE user_id=24`);
  const bc = await db.query(`SELECT COUNT(*)::int n FROM bets WHERE user_id=24`);
  const tc = await db.query(`SELECT COUNT(*)::int n FROM transactions WHERE user_id=24`);
  const wc = await db.query(`SELECT COUNT(*)::int n FROM withdrawals WHERE user_id=24`);
  const lc = await db.query(`SELECT COUNT(*)::int n FROM users WHERE referred_by=24`);
  console.log('\n=== USER 24 ===');
  console.log(u.rows[0]);
  console.log(`wallet cents: ${w.rows[0]?.balance_cents} | bets=${bc.rows[0].n} | transactions=${tc.rows[0].n} | withdrawals=${wc.rows[0].n} | leads=${lc.rows[0].n}`);

  await db.end();
  console.log('\n✅ Done. Login: karlosenrique367@gmail.com OR CPF 14485052400');
})().catch(e => { console.error(e); process.exit(1); });
