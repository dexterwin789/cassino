const router = require('express').Router();
const { query } = require('../config/database');
const { requireUser } = require('../middleware/auth');

// ──────────────────────────────────────────────────────────────
// User dashboard was removed. All settings are now in the wallet
// panel on the homepage. Any legacy /dashboard/* request redirects
// to the main page which hosts the in-place config UI.
// ──────────────────────────────────────────────────────────────
router.use(requireUser);

// Keep the /referrals data endpoint for any other consumer, but
// redirect browser navigations straight to the home wallet panel.
router.get('*', async (req, res, next) => {
  try {
    if (String(req.path || '').includes('referrals')) {
      const aff = await query('SELECT id FROM affiliates WHERE user_id = $1 AND is_active = TRUE LIMIT 1', [req.session.user.id]);
      if (!aff.rows.length) return res.redirect('/');
    }
    res.redirect('/#indique');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
