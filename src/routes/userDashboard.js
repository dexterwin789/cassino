const router = require('express').Router();
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { requireUser } = require('../middleware/auth');

router.use(requireUser);

// Dashboard home
router.get('/', async (req, res) => {
  try {
    const user = req.session.user;
    const [walletR, txR, recentR] = await Promise.all([
      query('SELECT balance_cents FROM wallets WHERE user_id = $1', [user.id]),
      query("SELECT COUNT(*) AS c, COALESCE(SUM(amount_cents),0) AS total FROM transactions WHERE user_id = $1 AND type='deposit' AND status='paid'", [user.id]),
      query(`SELECT id, type, status, amount_cents, created_at FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 10`, [user.id])
    ]);

    res.render('user/dashboard', {
      title: 'Dashboard',
      page: 'dashboard',
      u: user,
      balance_cents: parseInt(walletR.rows[0]?.balance_cents || 0),
      totalDeposits: parseInt(txR.rows[0]?.c || 0),
      totalDeposited: parseInt(txR.rows[0]?.total || 0),
      recentTx: recentR.rows
    });
  } catch (err) {
    console.error('[USER DASH]', err);
    res.status(500).send('Erro');
  }
});

// Transactions
router.get('/transactions', async (req, res) => {
  try {
    const user = req.session.user;
    const status = req.query.status || '';
    const pg = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = 20;
    const offset = (pg - 1) * limit;

    let where = ['user_id = $1'];
    let params = [user.id];
    let idx = 2;

    const allowed = ['pending', 'paid', 'failed', 'canceled'];
    if (status && allowed.includes(status)) {
      where.push(`status = $${idx}`);
      params.push(status);
      idx++;
    }

    const whereSql = 'WHERE ' + where.join(' AND ');
    const countR = await query(`SELECT COUNT(*) AS c FROM transactions ${whereSql}`, params);
    const total = parseInt(countR.rows[0].c);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const txR = await query(`
      SELECT id, type, status, amount_cents, provider, provider_ref, created_at
      FROM transactions ${whereSql}
      ORDER BY id DESC LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.render('user/transactions', {
      title: 'Transações',
      page: 'transactions',
      u: user,
      transactions: txR.rows,
      currentPage: pg,
      totalPages,
      total,
      filterStatus: status
    });
  } catch (err) {
    console.error('[USER TX]', err);
    res.status(500).send('Erro');
  }
});

// Security
router.get('/security', (req, res) => {
  res.render('user/security', {
    title: 'Segurança',
    page: 'security',
    u: req.session.user,
    msg: null,
    msgType: null
  });
});

// Change password
router.post('/security/password', async (req, res) => {
  try {
    const user = req.session.user;
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.render('user/security', { title: 'Segurança', page: 'security', u: user, msg: 'Preencha todos os campos.', msgType: 'error' });
    }
    if (new_password !== confirm_password) {
      return res.render('user/security', { title: 'Segurança', page: 'security', u: user, msg: 'Senhas não conferem.', msgType: 'error' });
    }
    if (new_password.length < 6 || new_password.length > 16) {
      return res.render('user/security', { title: 'Segurança', page: 'security', u: user, msg: 'Senha deve ter 6-16 caracteres.', msgType: 'error' });
    }

    const r = await query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    if (!r.rows[0] || !(await bcrypt.compare(current_password, r.rows[0].password_hash))) {
      return res.render('user/security', { title: 'Segurança', page: 'security', u: user, msg: 'Senha atual incorreta.', msgType: 'error' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, user.id]);

    res.render('user/security', { title: 'Segurança', page: 'security', u: user, msg: 'Senha alterada com sucesso!', msgType: 'success' });
  } catch (err) {
    console.error('[CHANGE PASS]', err);
    res.render('user/security', { title: 'Segurança', page: 'security', u: req.session.user, msg: 'Erro interno.', msgType: 'error' });
  }
});

// Referrals
router.get('/referrals', async (req, res) => {
  try {
    const user = req.session.user;
    const countR = await query('SELECT COUNT(*) AS c FROM users WHERE referred_by = $1', [user.id]);
    const baseUrl = process.env.NODE_ENV === 'production' ? (process.env.BASE_URL || 'https://cassino.up.railway.app') : 'http://localhost:3000';

    res.render('user/referrals', {
      title: 'Indicações',
      page: 'referrals',
      u: user,
      referralCount: parseInt(countR.rows[0].c),
      referralLink: `${baseUrl}/?ref=${user.id}`
    });
  } catch (err) {
    console.error('[REFERRALS]', err);
    res.status(500).send('Erro');
  }
});

module.exports = router;
