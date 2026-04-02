const router = require('express').Router();
const { query } = require('../config/database');
const { requireUser } = require('../middleware/auth');

router.use(requireUser);

router.get('/', async (req, res) => {
  try {
    const user = req.session.user;
    const [walletR, txR, recentR] = await Promise.all([
      query('SELECT balance_cents FROM wallets WHERE user_id = $1', [user.id]),
      query("SELECT COUNT(*) AS c, COALESCE(SUM(amount_cents),0) AS total FROM transactions WHERE user_id = $1 AND type='deposit' AND status='paid'", [user.id]),
      query(`SELECT id, type, status, amount_cents, created_at FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 10`, [user.id])
    ]);

    res.render('user/dashboard', {
      title: 'Minha Conta',
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

module.exports = router;
