// Cria/reseta uma conta de teste para validar fluxo de revshare
// Uso: node scripts/create_test_user.js
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const URL = 'postgresql://postgres:FSSRyVSBeEIjJNkmHTspwcGbuQyGoEdj@interchange.proxy.rlwy.net:11184/railway';

(async () => {
  const db = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const TEST_EMAIL = 'teste_revshare@vemnabet.bet';
  const TEST_USER = 'testerevshare';
  const TEST_PASS = 'Teste@2026';
  const TEST_CPF  = '98765432100';
  const TEST_NAME = 'Teste Revshare';
  const TEST_PHONE = '11999887766';
  const BALANCE_REAIS = 500;
  const BALANCE_CENTS = BALANCE_REAIS * 100;

  // Garante afiliado do user 24 (karlosenrique367)
  const affR = await db.query(`SELECT id, code FROM affiliates WHERE user_id=24 LIMIT 1`);
  if (!affR.rows.length) {
    console.error('Afiliado do user 24 não existe. Rode o seed primeiro.');
    process.exit(1);
  }
  const affiliateUserId = 24;
  const affiliateCode = affR.rows[0].code;

  const hash = await bcrypt.hash(TEST_PASS, 10);

  // Cria ou atualiza o user de teste
  const exist = await db.query(`SELECT id FROM users WHERE email=$1 OR username=$2`, [TEST_EMAIL, TEST_USER]);
  let userId;
  if (exist.rows.length) {
    userId = exist.rows[0].id;
    await db.query(
      `UPDATE users SET username=$2, email=$3, cpf=$4, phone=$5, password_hash=$6, name=$7,
         is_active=true, referred_by=$8, balance=$9, bonus=0, updated_at=NOW()
       WHERE id=$1`,
      [userId, TEST_USER, TEST_EMAIL, TEST_CPF, TEST_PHONE, hash, TEST_NAME, affiliateUserId, BALANCE_REAIS]
    );
    await db.query(`DELETE FROM bets WHERE user_id=$1`, [userId]);
    await db.query(`DELETE FROM transactions WHERE user_id=$1`, [userId]);
    await db.query(`DELETE FROM affiliate_commissions WHERE referred_user_id=$1`, [userId]);
  } else {
    const ins = await db.query(
      `INSERT INTO users (username,email,cpf,phone,password_hash,name,is_active,referred_by,balance,bonus,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,0,NOW(),NOW()) RETURNING id`,
      [TEST_USER, TEST_EMAIL, TEST_CPF, TEST_PHONE, hash, TEST_NAME, affiliateUserId, BALANCE_REAIS]
    );
    userId = ins.rows[0].id;
  }

  // Wallet com saldo real
  await db.query(
    `INSERT INTO wallets (user_id, balance_cents, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET balance_cents=$2, updated_at=NOW()`,
    [userId, BALANCE_CENTS]
  );

  // Depósito registrado (histórico)
  await db.query(
    `INSERT INTO transactions (user_id,type,status,amount_cents,provider,created_at,updated_at)
     VALUES ($1,'deposit','paid',$2,'manual', NOW(), NOW())`,
    [userId, BALANCE_CENTS]
  );

  console.log('\n=== CONTA DE TESTE CRIADA ===');
  console.log('ID:       ', userId);
  console.log('Username: ', TEST_USER);
  console.log('Email:    ', TEST_EMAIL);
  console.log('CPF:      ', TEST_CPF);
  console.log('Senha:    ', TEST_PASS);
  console.log('Saldo:    ', 'R$ ' + BALANCE_REAIS.toFixed(2));
  console.log('Indicada por: user_id', affiliateUserId, '(código', affiliateCode + ')');
  console.log('\nFluxo de teste:');
  console.log('1. Login em https://vemnabet.bet com', TEST_USER, '/', TEST_PASS);
  console.log('2. Aposte em qualquer jogo e perca');
  console.log('3. Verifique em affiliate_commissions (user 24) — deve ter linhas novas');

  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
