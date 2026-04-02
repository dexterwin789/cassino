const router = require('express').Router();
const bcrypt = require('bcrypt');
const { query, pool } = require('../config/database');
const { requireUser } = require('../middleware/auth');
const { createSale } = require('../services/blackcat');

// ─── Auth ─────────────────────────────────────────

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, phone } = req.body;
    const user = (username || '').trim();
    const pass = password || '';
    const ph = (phone || '').trim();

    if (!user || user.length < 3 || user.length > 32) {
      return res.status(400).json({ ok: false, msg: 'Usuário deve ter 3-32 caracteres.' });
    }
    if (pass.length < 6 || pass.length > 16) {
      return res.status(400).json({ ok: false, msg: 'Senha deve ter 6-16 caracteres.' });
    }
    if (ph && ph.length < 8) {
      return res.status(400).json({ ok: false, msg: 'Telefone inválido.' });
    }

    const exists = await query('SELECT id FROM users WHERE username = $1', [user]);
    if (exists.rows.length) {
      return res.status(409).json({ ok: false, msg: 'Usuário já existe.' });
    }

    const hash = await bcrypt.hash(pass, 10);
    const r = await query(
      'INSERT INTO users (username, phone, password_hash) VALUES ($1, $2, $3) RETURNING id, username, phone',
      [user, ph || null, hash]
    );
    const u = r.rows[0];

    // Create wallet
    await query('INSERT INTO wallets (user_id, balance_cents) VALUES ($1, 0)', [u.id]);

    req.session.user = u;
    res.json({ ok: true, user: u });
  } catch (err) {
    console.error('[REGISTER]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao registrar.' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, msg: 'Preencha todos os campos.' });
    }

    const r = await query('SELECT id, username, phone, password_hash FROM users WHERE username = $1', [username.trim()]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).json({ ok: false, msg: 'Usuário ou senha inválidos.' });
    }

    delete u.password_hash;
    req.session.user = u;
    res.json({ ok: true, user: u });
  } catch (err) {
    console.error('[LOGIN]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao fazer login.' });
  }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/me
router.get('/me', (req, res) => {
  if (!req.session.user) return res.json({ ok: true, logged: false });
  res.json({ ok: true, logged: true, user: req.session.user });
});

// ─── Wallet ───────────────────────────────────────

// GET /api/wallet
router.get('/wallet', requireUser, async (req, res) => {
  try {
    const r = await query('SELECT balance_cents FROM wallets WHERE user_id = $1', [req.session.user.id]);
    const cents = parseInt(r.rows[0]?.balance_cents || 0);
    res.json({ ok: true, logged: true, balance_cents: cents, balance_brl: (cents / 100).toFixed(2) });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao buscar saldo.' });
  }
});

// ─── Deposit ──────────────────────────────────────

// POST /api/deposit/create
router.post('/deposit/create', requireUser, async (req, res) => {
  try {
    const amountBrl = parseFloat(req.body.amount_brl);
    if (isNaN(amountBrl) || amountBrl < 30 || amountBrl > 50000) {
      return res.status(400).json({ ok: false, msg: 'Valor deve ser entre R$30 e R$50.000.' });
    }

    const amountCents = Math.round(amountBrl * 100);
    const user = req.session.user;

    // 1) Create pending transaction
    const txR = await query(
      `INSERT INTO transactions (user_id, type, status, amount_cents, provider) 
       VALUES ($1, 'deposit', 'pending', $2, 'blackcat') RETURNING id`,
      [user.id, amountCents]
    );
    const txId = txR.rows[0].id;
    const externalRef = String(txId);

    await query('UPDATE transactions SET provider_ref = $1 WHERE id = $2', [externalRef, txId]);

    // 2) Call BlackCat
    const resp = await createSale(amountCents, 'Deposito', user, externalRef);

    // Save payload
    await query('UPDATE transactions SET payload_json = $1 WHERE id = $2', [JSON.stringify(resp), txId]);

    const data = resp.data || {};
    const providerTxId = data.transactionId;
    const paymentData = data.paymentData || {};
    const copyPaste = paymentData.copyPaste || paymentData.qrCode || null;

    if (!providerTxId || !copyPaste) {
      await query("UPDATE transactions SET status = 'failed' WHERE id = $1", [txId]);
      return res.status(502).json({ ok: false, msg: 'Resposta inválida do gateway.' });
    }

    res.json({
      ok: true,
      tx_id: txId,
      externalReference: externalRef,
      transactionId: String(providerTxId),
      amount_cents: amountCents,
      copyPaste: String(copyPaste),
      invoiceUrl: String(data.invoiceUrl || ''),
      qrCodeBase64: null
    });
  } catch (err) {
    console.error('[DEPOSIT]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao processar depósito.' });
  }
});

// GET /api/deposit/status?tx_id=X
router.get('/deposit/status', requireUser, async (req, res) => {
  try {
    const txId = parseInt(req.query.tx_id);
    if (!txId) return res.status(400).json({ ok: false, msg: 'tx_id obrigatório.' });

    const r = await query(
      'SELECT id, status FROM transactions WHERE id = $1 AND user_id = $2',
      [txId, req.session.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ ok: false, msg: 'Transação não encontrada.' });

    const status = r.rows[0].status.toLowerCase();
    res.json({ ok: true, tx_id: r.rows[0].id, status, paid: status === 'paid' });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao verificar status.' });
  }
});

// ─── Games ────────────────────────────────────────

// GET /api/games
router.get('/games', async (req, res) => {
  try {
    const cat = req.query.category || '';
    let sql = 'SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE';
    const params = [];

    if (cat) {
      sql += ' AND category = $1';
      params.push(cat);
    }

    sql += ' ORDER BY sort_order, id DESC';

    const r = await query(sql, params);
    res.json({ ok: true, games: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao buscar jogos.' });
  }
});

// GET /api/banners
router.get('/banners', async (req, res) => {
  try {
    const r = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    res.json({ ok: true, banners: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao buscar banners.' });
  }
});

// ─── User Account ─────────────────────────────────

// POST /api/user/change-password
router.post('/user/change-password', requireUser, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ ok: false, msg: 'Preencha todos os campos.' });
    }
    if (new_password.length < 6 || new_password.length > 16) {
      return res.status(400).json({ ok: false, msg: 'Nova senha deve ter 6-16 caracteres.' });
    }

    const r = await query('SELECT password_hash FROM users WHERE id = $1', [req.session.user.id]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, msg: 'Usuário não encontrado.' });

    const valid = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!valid) return res.status(401).json({ ok: false, msg: 'Senha atual incorreta.' });

    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.session.user.id]);

    res.json({ ok: true, msg: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('[CHANGE_PASSWORD]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao alterar senha.' });
  }
});

module.exports = router;
