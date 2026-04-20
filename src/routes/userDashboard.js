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
    const baseUrl = process.env.BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://vemnabet.bet' : 'http://localhost:3000');

    // Load settings
    const setR = await query(
      `SELECT key, value FROM platform_settings
       WHERE key IN ('aff_referral_bonus','aff_default_commission','aff_min_deposit','aff_revshare_enabled','aff_revshare_pct')`
    );
    const s = {};
    setR.rows.forEach(r => { s[r.key] = r.value; });
    const referralBonusCents = parseInt(s.aff_referral_bonus || '5000', 10);
    const minDepositCents = parseInt(s.aff_min_deposit || '2000', 10);
    const defaultCommissionPct = parseFloat(s.aff_default_commission || '10');
    const revshareEnabled = s.aff_revshare_enabled === '1';
    const revsharePct = parseFloat(s.aff_revshare_pct || '0');

    // Ensure affiliate row exists
    let affR = await query('SELECT id, code, commission_pct, total_earned_cents FROM affiliates WHERE user_id = $1', [user.id]);
    if (!affR.rows.length) {
      const code = ('VNB' + user.id + Math.random().toString(36).slice(2, 6)).toUpperCase();
      await query(
        `INSERT INTO affiliates (user_id, code, commission_pct, is_active) VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, code, defaultCommissionPct]
      );
      affR = await query('SELECT id, code, commission_pct, total_earned_cents FROM affiliates WHERE user_id = $1', [user.id]);
    }
    const affiliate = affR.rows[0];

    // Leads list
    const leadsR = await query(`
      SELECT u.id, u.username, u.name, u.email, u.created_at,
        COALESCE((SELECT SUM(amount_cents) FROM transactions WHERE user_id = u.id AND status = 'paid' AND type IN ('deposit','pix_in')), 0) AS deposited_cents,
        COALESCE((SELECT COUNT(*) FROM bets WHERE user_id = u.id), 0) AS bets_count,
        COALESCE((SELECT SUM(amount_cents) FROM bets WHERE user_id = u.id AND status = 'lost'), 0) AS lost_cents,
        COALESCE((SELECT SUM(amount_cents) FROM affiliate_commissions WHERE referred_user_id = u.id AND affiliate_id = $2), 0) AS earned_cents
      FROM users u
      WHERE u.referred_by = $1
      ORDER BY u.created_at DESC
      LIMIT 200
    `, [user.id, affiliate.id]);
    const leads = leadsR.rows.map(r => ({
      id: r.id,
      username: r.username,
      name: r.name,
      createdAt: r.created_at,
      depositedCents: parseInt(r.deposited_cents || 0),
      betsCount: parseInt(r.bets_count || 0),
      lostCents: parseInt(r.lost_cents || 0),
      earnedCents: parseInt(r.earned_cents || 0)
    }));

    // Stats
    const statsR = await query(`
      SELECT
        COUNT(*) FILTER (WHERE type = 'deposit') AS deposit_count,
        COUNT(*) FILTER (WHERE type = 'revshare') AS revshare_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS paid_cents,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'pending'), 0) AS pending_cents,
        COALESCE(SUM(amount_cents) FILTER (WHERE type = 'deposit'), 0) AS deposit_cents,
        COALESCE(SUM(amount_cents) FILTER (WHERE type = 'revshare'), 0) AS revshare_cents
      FROM affiliate_commissions
      WHERE affiliate_id = $1
    `, [affiliate.id]);
    const stats = statsR.rows[0];

    const leadsWithDeposit = leads.filter(l => l.depositedCents > 0).length;
    const totalDepositsByLeadsCents = leads.reduce((a, l) => a + l.depositedCents, 0);

    res.render('user/referrals', {
      title: 'Indique e Ganhe',
      page: 'referrals',
      u: user,
      referralCount: leads.length,
      referralLink: `${baseUrl}/?ref=${user.id}`,
      affiliate,
      leads,
      stats: {
        leadsTotal: leads.length,
        leadsWithDeposit,
        totalDepositsByLeadsCents,
        paidCents: parseInt(stats.paid_cents || 0),
        pendingCents: parseInt(stats.pending_cents || 0),
        depositCents: parseInt(stats.deposit_cents || 0),
        revshareCents: parseInt(stats.revshare_cents || 0)
      },
      settings: {
        referralBonusCents,
        minDepositCents,
        defaultCommissionPct,
        revshareEnabled,
        revsharePct,
        affiliateCommissionPct: parseFloat(affiliate.commission_pct)
      }
    });
  } catch (err) {
    console.error('[REFERRALS]', err);
    res.status(500).send('Erro');
  }
});

module.exports = router;
