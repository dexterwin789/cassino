const router = require('express').Router();
const { pool, query } = require('../config/database');

// Helper: get user by code (email/username)
async function findUser(userCode) {
  const r = await query(
    'SELECT u.id, u.username, u.email, w.balance_cents FROM users u JOIN wallets w ON w.user_id = u.id WHERE u.email = $1 OR u.username = $1 LIMIT 1',
    [userCode]
  );
  return r.rows[0] || null;
}

// POST /api/webhook/playfivers — Single callback URL
// PlayFivers sends BALANCE or TRANSACTION events here
// Also handle sub-paths /balance and /transaction for backwards compat
router.post('/', handleWebhook);
router.post('/balance', handleWebhook);
router.post('/transaction', handleWebhook);

async function handleWebhook(req, res) {
  const body = req.body || {};
  const type = (body.type || '').toUpperCase();

  console.log('[PF WEBHOOK] Incoming:', JSON.stringify({
    path: req.originalUrl,
    type: body.type,
    user_code: body.user_code,
    game_type: body.game_type,
    hasSlotField: !!body.slot,
    bodyKeys: Object.keys(body)
  }));

  // If it's a BALANCE check (no slot/game_type data)
  if (type === 'BALANCE' || (!body.game_type && !body.slot)) {
    return handleBalance(req, res);
  }
  // Otherwise it's a transaction
  return handleTransaction(req, res);
}

async function handleBalance(req, res) {
  try {
    const { user_code } = req.body;
    console.log('[PF WEBHOOK BALANCE]', { user_code });

    if (!user_code) {
      return res.status(400).json({ balance: 0, msg: 'MISSING_USER_CODE' });
    }

    const user = await findUser(user_code);
    if (!user) {
      return res.status(404).json({ balance: 0, msg: 'INVALID_USER' });
    }

    const balance = parseFloat((parseInt(user.balance_cents) / 100).toFixed(2));
    res.json({ balance, msg: '' });
  } catch (err) {
    console.error('[PF WEBHOOK BALANCE]', err);
    res.status(500).json({ balance: 0, msg: 'ERROR_INTERNAL' });
  }
}

async function handleTransaction(req, res) {
  const client = await pool.connect();
  try {
    const { type, user_code, user_balance, game_type } = req.body;
    const gameData = req.body[game_type] || req.body.slot || {};
    const { provider_code, game_code, round_id, bet, win, txn_id, txn_type, user_before_balance, user_after_balance } = gameData;

    console.log('[PF WEBHOOK TXN] Full detail:', JSON.stringify({
      type, user_code, game_type, txn_id, txn_type, bet, win, provider_code, game_code,
      gameDataKeys: Object.keys(gameData),
      gameDataResolved: game_type ? `body[${game_type}]` : 'body.slot',
      rawGameTypeField: !!req.body[game_type],
      rawSlotField: !!req.body.slot
    }));

    if (!user_code) {
      return res.status(400).json({ balance: 0, msg: 'MISSING_USER_CODE' });
    }

    const user = await findUser(user_code);
    if (!user) {
      return res.status(404).json({ balance: 0, msg: 'INVALID_USER' });
    }

    // Idempotency: skip if txn_id already processed
    if (txn_id) {
      const dupCheck = await query('SELECT id FROM game_transactions WHERE txn_id = $1', [txn_id]);
      if (dupCheck.rows.length) {
        const balance = parseFloat((parseInt(user.balance_cents) / 100).toFixed(2));
        return res.json({ balance, msg: '' });
      }
    }

    await client.query('BEGIN');

    // Lock wallet row
    const walletR = await client.query(
      'SELECT balance_cents FROM wallets WHERE user_id = $1 FOR UPDATE',
      [user.id]
    );
    let currentBalance = parseInt(walletR.rows[0].balance_cents);

    const betCents = Math.round((parseFloat(bet) || 0) * 100);
    const winCents = Math.round((parseFloat(win) || 0) * 100);

    // Calculate net change based on txn_type
    let netChange = 0;
    if (txn_type === 'debit_credit') {
      // Combined: debit bet, credit win
      netChange = winCents - betCents;
    } else if (txn_type === 'debit') {
      netChange = -betCents;
    } else if (txn_type === 'credit' || txn_type === 'bonus') {
      netChange = winCents;
    } else {
      // Default: trust the net difference
      netChange = winCents - betCents;
    }

    console.log('[PF WEBHOOK TXN] Balance check:', {
      user_code, currentBalance, betCents, winCents, netChange, txn_type,
      willFail: netChange < 0 && (currentBalance + netChange) < 0
    });

    // Check sufficient funds for debit
    if (netChange < 0 && (currentBalance + netChange) < 0) {
      await client.query('ROLLBACK');
      console.error('[PF WEBHOOK TXN] INSUFFICIENT FUNDS:', { user_code, currentBalance, netChange, needed: Math.abs(netChange) });
      return res.status(400).json({ balance: parseFloat((currentBalance / 100).toFixed(2)), msg: 'INSUFFICIENT_USER_FUNDS' });
    }

    // Update wallet
    const newBalance = currentBalance + netChange;
    await client.query(
      'UPDATE wallets SET balance_cents = $1, updated_at = NOW() WHERE user_id = $2',
      [newBalance, user.id]
    );

    // Find game by pf_game_code
    let gameId = null;
    if (game_code) {
      const gameR = await client.query('SELECT id FROM games WHERE pf_game_code = $1 LIMIT 1', [game_code]);
      if (gameR.rows[0]) gameId = gameR.rows[0].id;
    }

    // Record transaction
    await client.query(
      `INSERT INTO game_transactions (user_id, game_id, txn_id, round_id, txn_type, bet_cents, win_cents, balance_before, balance_after, provider_code, pf_game_code, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [user.id, gameId, txn_id || null, round_id || null, txn_type || type, betCents, winCents, currentBalance, newBalance, provider_code || null, game_code || null, JSON.stringify(req.body)]
    );

    // Also add to bets table for the dashboard
    let insertedBetId = null;
    let insertedBetStatus = null;
    if (betCents > 0 || winCents > 0) {
      const betStatus = winCents > betCents ? 'won' : (winCents > 0 ? 'partial' : 'lost');
      insertedBetStatus = betStatus;
      try {
        const betIns = await client.query(
          `INSERT INTO bets (user_id, game_id, round_id, amount_cents, payout_cents, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT DO NOTHING RETURNING id`,
          [user.id, gameId, round_id ? parseInt(round_id) || 0 : 0, betCents, winCents, betStatus]
        );
        if (betIns.rows[0]) insertedBetId = betIns.rows[0].id;
      } catch {}
    }

    await client.query('COMMIT');

    // RevShare: commission on lost bets (fire-and-forget, after commit)
    if (insertedBetId && insertedBetStatus === 'lost' && betCents > 0) {
      creditRevshareCommission(user.id, insertedBetId, betCents).catch(err => {
        console.error('[REVSHARE]', err.message);
      });
    }

    res.json({ balance: parseFloat((newBalance / 100).toFixed(2)), msg: '' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[PF WEBHOOK TXN]', err);
    res.status(500).json({ balance: 0, msg: 'ERROR_INTERNAL' });
  } finally {
    client.release();
  }
}

// ----- RevShare: credit commission to affiliate when indicated user LOSES a bet
async function creditRevshareCommission(userId, betId, betAmountCents) {
  // Check if revshare is enabled
  const setR = await query(
    `SELECT key, value FROM platform_settings WHERE key IN ('aff_revshare_enabled','aff_revshare_pct')`
  );
  const s = {};
  setR.rows.forEach(r => { s[r.key] = r.value; });
  if (s.aff_revshare_enabled !== '1') return;
  const pct = parseFloat(s.aff_revshare_pct || '0');
  if (!pct || pct <= 0) return;

  // Find this user's referrer via affiliates table
  const userR = await query('SELECT referred_by FROM users WHERE id = $1', [userId]);
  const referrerId = userR.rows[0]?.referred_by;
  if (!referrerId) return;

  const affR = await query('SELECT id FROM affiliates WHERE user_id = $1 AND is_active = TRUE LIMIT 1', [referrerId]);
  const affiliateId = affR.rows[0]?.id;
  if (!affiliateId) return;

  const commissionCents = Math.round(betAmountCents * pct / 100);
  if (commissionCents <= 0) return;

  await query(
    `INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, bet_id, amount_cents, status, type, created_at)
     VALUES ($1, $2, $3, $4, 'pending', 'revshare', NOW())`,
    [affiliateId, userId, betId, commissionCents]
  );
}

module.exports = router;