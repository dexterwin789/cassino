const router = require('express').Router();
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

// ─── Admin Auth Pages ─────────────────────────────

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null, title: 'Login Admin' });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('admin/login', { error: 'Preencha todos os campos.', title: 'Login Admin' });
  }
  try {
    const r = await query('SELECT id, username, password_hash, role, is_active FROM admin_users WHERE username = $1', [username.trim()]);
    const adm = r.rows[0];
    if (!adm || !adm.is_active || !(await bcrypt.compare(password, adm.password_hash))) {
      return res.render('admin/login', { error: 'Usuário ou senha inválidos.', title: 'Login Admin' });
    }
    req.session.admin = { id: adm.id, username: adm.username, role: adm.role };
    req.session.save((saveErr) => {
      if (saveErr) console.error('[ADMIN LOGIN] session save:', saveErr);
      res.redirect('/admin');
    });
  } catch (err) {
    console.error('[ADMIN LOGIN]', err);
    res.render('admin/login', { error: 'Erro interno.', title: 'Login Admin' });
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

router.get('/banners', requireAdmin, async (req, res) => {
  const r = await query('SELECT key, value FROM platform_settings ORDER BY key');
  const settings = {};
  r.rows.forEach(row => { settings[row.key] = row.value; });
  res.render('admin/banners', { title: 'Banners', admin: req.session.admin, settings });
});

router.get('/bets', requireAdmin, (req, res) => {
  res.render('admin/bets', { title: 'Apostas', admin: req.session.admin });
});

router.get('/affiliates', requireAdmin, async (req, res) => {
  const r = await query('SELECT key, value FROM platform_settings WHERE key LIKE $1 ORDER BY key', ['aff_%']);
  const affSettings = {};
  r.rows.forEach(row => { affSettings[row.key] = row.value; });
  // Stats dashboard
  let affStats = { total: 0, active: 0, totalEarned: 0, pendingCommissions: 0, totalLeads: 0 };
  try {
    const s = await query(`
      SELECT
        (SELECT COUNT(*) FROM affiliates)::int AS total,
        (SELECT COUNT(*) FROM affiliates WHERE is_active = true)::int AS active,
        (SELECT COALESCE(SUM(total_earned_cents),0) FROM affiliates)::bigint AS total_earned,
        (SELECT COALESCE(SUM(amount_cents),0) FROM affiliate_commissions WHERE status = 'pending')::bigint AS pending,
        (SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL)::int AS leads
    `);
    const row = s.rows[0] || {};
    affStats = {
      total: Number(row.total || 0),
      active: Number(row.active || 0),
      totalEarned: Number(row.total_earned || 0),
      pendingCommissions: Number(row.pending || 0),
      totalLeads: Number(row.leads || 0)
    };
  } catch (e) { /* tables may not exist yet */ }
  res.render('admin/affiliates', { title: 'Afiliados', admin: req.session.admin, affSettings, affStats });
});

router.get('/support', requireAdmin, (req, res) => {
  res.render('admin/support', { title: 'Suporte', admin: req.session.admin });
});

router.get('/withdrawals', requireAdmin, (req, res) => {
  res.render('admin/withdrawals', { title: 'Saques', admin: req.session.admin });
});

router.get('/reports', requireAdmin, (req, res) => {
  res.render('admin/reports', { title: 'Relatórios', admin: req.session.admin });
});

router.get('/notifications', requireAdmin, (req, res) => {
  res.render('admin/notifications', { title: 'Notificações', admin: req.session.admin });
});

router.get('/limits', requireAdmin, (req, res) => {
  res.render('admin/limits', { title: 'Jogo Responsável', admin: req.session.admin });
});

router.get('/leagues', requireAdmin, (req, res) => {
  res.render('admin/leagues', { title: 'Ligas & Esportes', admin: req.session.admin });
});

router.get('/coupons', requireAdmin, (req, res) => {
  res.render('admin/coupons', { title: 'Cupons', admin: req.session.admin });
});

router.get('/promotions', requireAdmin, (req, res) => {
  res.render('admin/promotions', { title: 'Promoções', admin: req.session.admin });
});

router.get('/top10', requireAdmin, (req, res) => {
  res.render('admin/top10', { title: 'Top 10', admin: req.session.admin });
});

router.get('/audit', requireAdmin, (req, res) => {
  res.render('admin/audit', { title: 'Log de Auditoria', admin: req.session.admin });
});

router.get('/providers', requireAdmin, (req, res) => {
  res.render('admin/providers', { title: 'Provedores', admin: req.session.admin });
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
