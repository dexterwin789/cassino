const router = require('express').Router();
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

// ─── Admin Auth Pages ─────────────────────────────

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null, title: 'Admin Login' });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('admin/login', { error: 'Preencha todos os campos.', title: 'Admin Login' });
  }
  try {
    const r = await query('SELECT id, username, password_hash, role, is_active FROM admin_users WHERE username = $1', [username.trim()]);
    const adm = r.rows[0];
    if (!adm || !adm.is_active || !(await bcrypt.compare(password, adm.password_hash))) {
      return res.render('admin/login', { error: 'Usuário ou senha inválidos.', title: 'Admin Login' });
    }
    req.session.admin = { id: adm.id, username: adm.username, role: adm.role };
    req.session.save((saveErr) => {
      if (saveErr) console.error('[ADMIN LOGIN] session save:', saveErr);
      res.redirect('/admin');
    });
  } catch (err) {
    console.error('[ADMIN LOGIN]', err);
    res.render('admin/login', { error: 'Erro interno.', title: 'Admin Login' });
  }
});

router.get('/logout', (req, res) => {
  delete req.session.admin;
  res.redirect('/admin/login');
});

// ─── Admin Dashboard Pages ────────────────────────

router.get('/', requireAdmin, async (req, res) => {
  try {
    const [usersR, txR, gamesR, revenueR, todayR] = await Promise.all([
      query('SELECT COUNT(*) AS c FROM users'),
      query("SELECT COUNT(*) AS c FROM transactions WHERE type='deposit' AND status='paid'"),
      query('SELECT COUNT(*) AS c FROM games WHERE is_active = TRUE'),
      query("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions WHERE type='deposit' AND status='paid'"),
      query("SELECT COUNT(*) AS c FROM users WHERE created_at >= CURRENT_DATE")
    ]);

    res.render('admin/dashboard', {
      title: 'Dashboard',
      admin: req.session.admin,
      stats: {
        totalUsers: parseInt(usersR.rows[0].c),
        totalDeposits: parseInt(txR.rows[0].c),
        totalGames: parseInt(gamesR.rows[0].c),
        totalRevenue: parseInt(revenueR.rows[0].total),
        todayUsers: parseInt(todayR.rows[0].c)
      }
    });
  } catch (err) {
    console.error('[ADMIN DASHBOARD]', err);
    res.status(500).send('Erro');
  }
});

router.get('/users', requireAdmin, (req, res) => {
  res.render('admin/users', { title: 'Usuários', admin: req.session.admin });
});

router.get('/deposits', requireAdmin, (req, res) => {
  res.render('admin/deposits', { title: 'Depósitos', admin: req.session.admin });
});

router.get('/games', requireAdmin, (req, res) => {
  res.render('admin/games', { title: 'Jogos', admin: req.session.admin });
});

router.get('/transactions', requireAdmin, (req, res) => {
  res.render('admin/transactions', { title: 'Transações', admin: req.session.admin });
});

router.get('/banners', requireAdmin, (req, res) => {
  res.render('admin/banners', { title: 'Banners', admin: req.session.admin });
});

router.get('/bets', requireAdmin, (req, res) => {
  res.render('admin/bets', { title: 'Apostas', admin: req.session.admin });
});

router.get('/affiliates', requireAdmin, (req, res) => {
  res.render('admin/affiliates', { title: 'Afiliados', admin: req.session.admin });
});

router.get('/support', requireAdmin, (req, res) => {
  res.render('admin/support', { title: 'Suporte', admin: req.session.admin });
});

router.get('/promotions', requireAdmin, (req, res) => {
  res.render('admin/promotions', { title: 'Promoções', admin: req.session.admin });
});

router.get('/audit', requireAdmin, (req, res) => {
  res.render('admin/audit', { title: 'Audit Log', admin: req.session.admin });
});

router.get('/themes', requireAdmin, async (req, res) => {
  try {
    const r = await query('SELECT * FROM themes ORDER BY is_active DESC, name');
    const activeR = await query("SELECT value FROM platform_settings WHERE key = 'active_theme'");
    res.render('admin/themes', {
      title: 'Temas',
      admin: req.session.admin,
      themes: r.rows,
      activeTheme: activeR.rows[0]?.value || 'default'
    });
  } catch (err) {
    console.error('[ADMIN THEMES]', err);
    res.status(500).send('Erro');
  }
});

router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const r = await query('SELECT key, value FROM platform_settings ORDER BY key');
    const settings = {};
    r.rows.forEach(row => { settings[row.key] = row.value; });
    res.render('admin/settings', { title: 'Configurações', admin: req.session.admin, settings });
  } catch (err) {
    res.status(500).send('Erro');
  }
});

module.exports = router;
