// Seed prod DB: comprehensive seed for affiliate revshare testing
// User 24 (karlosenrique367@gmail.com) = afiliado
// Creates leads with varied dates (today/yesterday/7d), losing bets, and revshare commissions
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const URL = 'postgresql://postgres:FSSRyVSBeEIjJNkmHTspwcGbuQyGoEdj@interchange.proxy.rlwy.net:11184/railway';

(async () => {
  const db = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const AFFILIATE_USER_ID = 24;
  const REVSHARE_PCT = 0.40; // 40% do lucro da casa (losing bet)

  // ─── 1. Saldo + wallet do afiliado ───
  for (const uid of [22, AFFILIATE_USER_ID]) {
    await db.query(`UPDATE users SET balance=5000.00, bonus=500.00, updated_at=NOW() WHERE id=$1`, [uid]);
    await db.query(`INSERT INTO wallets (user_id, balance_cents, updated_at) VALUES ($1, 500000, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET balance_cents=500000, updated_at=NOW()`, [uid]);
  }

  // ─── 2. Garante registro de afiliado para user 24 ───
  const affR = await db.query(`SELECT id, code FROM affiliates WHERE user_id=$1`, [AFFILIATE_USER_ID]);
  let affiliateId, affiliateCode;
  if (affR.rows.length) {
    affiliateId = affR.rows[0].id;
    affiliateCode = affR.rows[0].code;
    await db.query(`UPDATE affiliates SET is_active=true, commission_pct=$2 WHERE id=$1`, [affiliateId, REVSHARE_PCT * 100]);
  } else {
    affiliateCode = 'KARLOS24';
    const r = await db.query(
      `INSERT INTO affiliates (user_id, code, commission_pct, total_earned_cents, is_active, created_at)
       VALUES ($1, $2, $3, 0, true, NOW()) RETURNING id`,
      [AFFILIATE_USER_ID, affiliateCode, REVSHARE_PCT * 100]
    );
    affiliateId = r.rows[0].id;
  }
  console.log('affiliate:', { id: affiliateId, code: affiliateCode, pct: (REVSHARE_PCT * 100) + '%' });

  // ─── 3. Leads com datas variadas (hoje, ontem, 3d, 7d) ───
  const hash = await bcrypt.hash('Teste@123', 10);
  const leadsData = [
    { email: 'lead_ana@test.com',    cpf: '22233344455', name: 'Ana Lead',    phone: '11988001122', daysAgo: 0,  label: 'hoje' },
    { email: 'lead_bruno@test.com',  cpf: '33344455566', name: 'Bruno Lead',  phone: '21977002233', daysAgo: 1,  label: 'ontem' },
    { email: 'lead_carol@test.com',  cpf: '44455566677', name: 'Carol Lead',  phone: '31966003344', daysAgo: 3,  label: '3 dias' },
    { email: 'lead_diego@test.com',  cpf: '55566677788', name: 'Diego Lead',  phone: '41955004455', daysAgo: 7,  label: '7 dias' }
  ];

  let totalCommission = 0;

  for (const L of leadsData) {
    const exist = await db.query(`SELECT id FROM users WHERE email=$1`, [L.email]);
    let leadId;
    // Data BR: meio-dia do dia X (seguro para any timezone check)
    const createdAtSql = `((NOW() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '${L.daysAgo} days' + INTERVAL '14 hours') AT TIME ZONE 'America/Sao_Paulo'`;

    if (exist.rows.length) {
      leadId = exist.rows[0].id;
      await db.query(
        `UPDATE users SET referred_by=$2, name=$3, cpf=$4, phone=$5, created_at=${createdAtSql} WHERE id=$1`,
        [leadId, AFFILIATE_USER_ID, L.name, L.cpf, L.phone]
      );
      // limpa apostas/transações anteriores do lead para reset idempotente
      await db.query(`DELETE FROM affiliate_commissions WHERE referred_user_id=$1`, [leadId]);
      await db.query(`DELETE FROM bets WHERE user_id=$1`, [leadId]);
      await db.query(`DELETE FROM transactions WHERE user_id=$1`, [leadId]);
    } else {
      const ins = await db.query(
        `INSERT INTO users (username,email,cpf,phone,password_hash,name,is_active,referred_by,created_at,updated_at)
         VALUES ($1,$1,$2,$3,$4,$5,true,$6, ${createdAtSql}, NOW()) RETURNING id`,
        [L.email, L.cpf, L.phone, hash, L.name, AFFILIATE_USER_ID]
      );
      leadId = ins.rows[0].id;
    }

    // Wallet do lead
    await db.query(`INSERT INTO wallets (user_id, balance_cents, updated_at) VALUES ($1, 0, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET updated_at=NOW()`, [leadId]);

    // Depósito (R$ 100 para cada lead)
    const depCents = 10000;
    await db.query(
      `INSERT INTO transactions (user_id,type,status,amount_cents,provider,created_at,updated_at)
       VALUES ($1,'deposit','paid',$2,'blackcat', ${createdAtSql} + INTERVAL '1 hour', NOW())`,
      [leadId, depCents]
    );

    // 3 apostas por lead (2 losing, 1 winning) para gerar revshare
    const bets = [
      { amount: 5000, payout: 0,     status: 'lost', minAgo: 120 },  // -R$50
      { amount: 3000, payout: 0,     status: 'lost', minAgo: 90 },   // -R$30
      { amount: 2000, payout: 3500,  status: 'won',  minAgo: 60 }    // +R$15
    ];
    let leadRevshare = 0;
    for (const b of bets) {
      const betR = await db.query(
        `INSERT INTO bets (user_id,game_id,amount_cents,payout_cents,multiplier,status,created_at)
         VALUES ($1,1,$2,$3,$4,$5, ${createdAtSql} + INTERVAL '${180 - b.minAgo} minutes')
         RETURNING id`,
        [leadId, b.amount, b.payout, b.payout > 0 ? (b.payout / b.amount) : 0, b.status]
      );
      const betId = betR.rows[0].id;
      // Revshare = pct * (aposta - payout). Só ganha se lead perdeu dinheiro líquido.
      const houseProfit = b.amount - b.payout;
      if (houseProfit > 0) {
        const commissionCents = Math.floor(houseProfit * REVSHARE_PCT);
        leadRevshare += commissionCents;
        await db.query(
          `INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, transaction_id, amount_cents, status, type, bet_id, created_at)
           VALUES ($1,$2,NULL,$3,'paid','revshare',$4, ${createdAtSql} + INTERVAL '${180 - b.minAgo + 1} minutes')`,
          [affiliateId, leadId, commissionCents, betId]
        );
      }
    }
    totalCommission += leadRevshare;
    console.log(`lead: ${L.email} (${L.label}) id=${leadId} revshare=R$ ${(leadRevshare/100).toFixed(2)}`);
  }

  // ─── 4. Atualiza total earned do afiliado ───
  await db.query(`UPDATE affiliates SET total_earned_cents=$2 WHERE id=$1`, [affiliateId, totalCommission]);

  // ─── 5. Transações variadas para user 24 (extrato rico com datas hoje/ontem/7d) ───
  await db.query(`DELETE FROM transactions WHERE user_id=$1`, [AFFILIATE_USER_ID]);
  await db.query(`DELETE FROM withdrawals WHERE user_id=$1`, [AFFILIATE_USER_ID]);

  const brDate = (daysAgo, hours) => `((NOW() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '${daysAgo} days' + INTERVAL '${hours} hours') AT TIME ZONE 'America/Sao_Paulo'`;

  const txs = [
    { type: 'deposit',  status: 'paid',    amount: 10000, prov: 'blackcat', daysAgo: 7, hours: 10 },
    { type: 'deposit',  status: 'paid',    amount: 5000,  prov: 'blackcat', daysAgo: 3, hours: 14 },
    { type: 'bonus',    status: 'paid',    amount: 2500,  prov: 'system',   daysAgo: 2, hours: 15 },
    { type: 'deposit',  status: 'paid',    amount: 20000, prov: 'blackcat', daysAgo: 1, hours: 16 },
    { type: 'deposit',  status: 'pending', amount: 3000,  prov: 'blackcat', daysAgo: 0, hours: 11 },
    { type: 'deposit',  status: 'paid',    amount: 15000, prov: 'blackcat', daysAgo: 0, hours: 18 }
  ];
  for (const T of txs) {
    await db.query(
      `INSERT INTO transactions (user_id,type,status,amount_cents,provider,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5, ${brDate(T.daysAgo, T.hours)}, NOW())`,
      [AFFILIATE_USER_ID, T.type, T.status, T.amount, T.prov]
    );
  }

  // 1 saque hoje
  await db.query(
    `INSERT INTO withdrawals (user_id,amount_cents,pix_type,pix_key,status,created_at,updated_at)
     VALUES ($1,5000,'cpf','144.850.524-00','pending', ${brDate(0, 12)}, NOW())`,
    [AFFILIATE_USER_ID]
  );

  // Apostas variadas para user 24 com datas hoje/ontem/7d
  await db.query(`DELETE FROM bets WHERE user_id=$1`, [AFFILIATE_USER_ID]);
  const userBets = [
    { amount: 500,  payout: 0,    status: 'lost', daysAgo: 0, hours: 19 },
    { amount: 1000, payout: 1800, status: 'won',  daysAgo: 0, hours: 17 },
    { amount: 2000, payout: 0,    status: 'lost', daysAgo: 0, hours: 13 },
    { amount: 500,  payout: 750,  status: 'won',  daysAgo: 1, hours: 20 },
    { amount: 1500, payout: 0,    status: 'lost', daysAgo: 1, hours: 15 },
    { amount: 3000, payout: 5400, status: 'won',  daysAgo: 3, hours: 16 },
    { amount: 1000, payout: 0,    status: 'lost', daysAgo: 7, hours: 14 }
  ];
  for (const B of userBets) {
    await db.query(
      `INSERT INTO bets (user_id,game_id,amount_cents,payout_cents,multiplier,status,created_at)
       VALUES ($1,1,$2,$3,$4,$5, ${brDate(B.daysAgo, B.hours)})`,
      [AFFILIATE_USER_ID, B.amount, B.payout, B.payout > 0 ? (B.payout / B.amount) : 0, B.status]
    );
  }

  // ─── 6. Login history ───
  await db.query(`DELETE FROM login_history WHERE user_id=$1`, [AFFILIATE_USER_ID]);
  const logins = [
    { daysAgo: 0, hours: 19, ip: '186.208.74.56', city: 'São Paulo', state: 'SP' },
    { daysAgo: 0, hours: 10, ip: '186.208.74.56', city: 'São Paulo', state: 'SP' },
    { daysAgo: 1, hours: 21, ip: '186.208.74.56', city: 'São Paulo', state: 'SP' },
    { daysAgo: 1, hours: 8,  ip: '191.243.12.88', city: 'Rio de Janeiro', state: 'RJ' },
    { daysAgo: 3, hours: 14, ip: '186.208.74.56', city: 'São Paulo', state: 'SP' },
    { daysAgo: 7, hours: 9,  ip: '186.208.74.56', city: 'São Paulo', state: 'SP' }
  ];
  for (const L of logins) {
    await db.query(
      `INSERT INTO login_history (user_id,ip,city,state,coords,user_agent,created_at)
       VALUES ($1,$2,$3,$4,'','Mozilla/5.0', ${brDate(L.daysAgo, L.hours)})`,
      [AFFILIATE_USER_ID, L.ip, L.city, L.state]
    );
  }

  // ─── 7. Notificações para user 24 ───
  await db.query(`DELETE FROM notifications WHERE user_id=$1`, [AFFILIATE_USER_ID]);
  const notifs = [
    { tipo: 'success', titulo: 'Depósito confirmado', msg: 'Seu depósito de R$ 150,00 foi creditado.', lida: false, hoursAgo: 2 },
    { tipo: 'promo',   titulo: 'Comissão recebida',  msg: 'Você ganhou R$ 20,00 de revshare da Ana.', lida: false, hoursAgo: 4 },
    { tipo: 'info',    titulo: 'Novo indicado',      msg: 'Ana Lead se cadastrou usando seu link.', lida: false, hoursAgo: 6 },
    { tipo: 'warning', titulo: 'Saque em análise',   msg: 'Seu saque de R$ 50,00 está em análise.', lida: true,  hoursAgo: 24 },
    { tipo: 'success', titulo: 'Prêmio ganho',       msg: 'Você ganhou R$ 18,00 no Fortune Tiger.', lida: true,  hoursAgo: 30 }
  ];
  for (const N of notifs) {
    await db.query(
      `INSERT INTO notifications (user_id,tipo,titulo,mensagem,lida,created_at)
       VALUES ($1,$2,$3,$4,$5, NOW() - INTERVAL '${N.hoursAgo} hours')`,
      [AFFILIATE_USER_ID, N.tipo, N.titulo, N.msg, N.lida]
    );
  }

  // ─── Report final ───
  console.log('\n=== RESUMO ===');
  const final = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE referred_by=$1) AS leads,
      (SELECT COUNT(*) FROM transactions WHERE user_id=$1) AS txs,
      (SELECT COUNT(*) FROM bets WHERE user_id=$1) AS bets,
      (SELECT COUNT(*) FROM withdrawals WHERE user_id=$1) AS wds,
      (SELECT COUNT(*) FROM notifications WHERE user_id=$1) AS notifs,
      (SELECT COUNT(*) FROM login_history WHERE user_id=$1) AS logins,
      (SELECT total_earned_cents FROM affiliates WHERE user_id=$1) AS affiliate_earned
  `, [AFFILIATE_USER_ID]);
  console.log(final.rows[0]);
  console.log(`Revshare total gerada: R$ ${(totalCommission / 100).toFixed(2)}`);
  console.log(`Link do afiliado: https://vemnabet.bet/?ref=${affiliateCode}`);

  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
