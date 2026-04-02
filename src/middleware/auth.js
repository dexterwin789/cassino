const { query } = require('../config/database');

function requireUser(req, res, next) {
  if (!req.session.user) {
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ ok: false, msg: 'Não autenticado.' });
    }
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ ok: false, msg: 'Não autenticado.' });
    }
    return res.redirect('/admin/login');
  }
  next();
}

async function refreshUser(req, res, next) {
  if (req.session.user) {
    try {
      const r = await query('SELECT id, username, phone, email, bonus, balance, credit_score, is_active, avatar_url, created_at FROM users WHERE id = $1', [req.session.user.id]);
      if (r.rows[0]) {
        req.session.user = r.rows[0];
      }
    } catch (e) { /* silent */ }
  }
  next();
}

module.exports = { requireUser, requireAdmin, refreshUser };
