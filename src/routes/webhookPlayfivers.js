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

// POST /api/webhook/playfivers/balance
// PlayFivers sends: { type: "BALANCE", user_code: "..." }
// We respond: { balance: 150.75, msg: "" }
router.post('/balance', async (req, res) => {
  try {
    const { type, user_code } = req.body;
    console.log('[PF WEBHOOK BALANCE]', { type, user_code });

    if (!user_code) {
      return res.status(400).json({ balance: 0, msg: 'MISSING_USER_CODE' });
    }

    const user = await findUser(user_code);
    if (!user) {
      return res.status(404).json({ balance: 0, msg: 'INVALID_USER' });
    }

    const balance = parseInt(user.balance_cents) / 100;
    res.json({ balance, msg: '' });
  } catch (err) {
    console.error('[PF WEBHOOK BALANCE]', err);
    res.status(500).json({ balance: 0, msg: 'ERROR_INTERNAL' });
  }
});

// POST /api/webhook/playfivers/transaction
// PlayFivers sends: { type, agent_code, agent_secret, user_code, user_balance, game_original, game_type, slot: {...} }
// We respond: { balance: 150.75, msg: "" }
router.post('/transaction', async (req, res) => {
  const client = await pool.connect();
  try {
    const { type, user_code, user_balance, game_type } = req.body;
    const gameData = req.body[game_type] || req.body.slot || {};
    const { provider_code, game_code, round_id, bet, win, txn_id, txn_type, user_before_balance, user_after_balance } = gameData;

    console.log('[PF WEBHOOK TXN]', { type, user_code, txn_id, txn_type, bet, win });

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
        const balance = parseInt(user.balance_cents) / 100;
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

    // Check sufficient funds for debit
    if (netChange < 0 && (currentBalance + netChange) < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ balance: currentBalance / 100, msg: 'INSUFFICIENT_USER_FUNDS' });
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
    if (betCents > 0 || winCents > 0) {
      const betStatus = winCents > betCents ? 'won' : (winCents > 0 ? 'partial' : 'lost');
      await client.query(
        `INSERT INTO bets (user_id, game_id, round_id, amount_cents, payout_cents, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT DO NOTHING`,
        [user.id, gameId, round_id ? parseInt(round_id) || 0 : 0, betCents, winCents, betStatus]
      ).catch(() => {}); // Non-critical
    }

    await client.query('COMMIT');

    res.json({ balance: newBalance / 100, msg: '' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[PF WEBHOOK TXN]', err);
    res.status(500).json({ balance: 0, msg: 'ERROR_INTERNAL' });
  } finally {
    client.release();
  }
});

module.exports = router;
