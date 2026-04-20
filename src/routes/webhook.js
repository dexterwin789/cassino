const router = require('express').Router();
const { pool, query } = require('../config/database');

// POST /api/webhook/blackcat
router.post('/blackcat', async (req, res) => {
  const { transactionId, status, amount, externalReference } = req.body;

  if (!transactionId || !status) {
    return res.status(400).json({ ok: false, msg: 'Campos obrigatórios ausentes.' });
  }

  console.log('[WEBHOOK] Received:', { transactionId, status, amount, externalReference });

  if (status.toUpperCase() !== 'PAID') {
    return res.json({ ok: true, ignored: true, status });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock row for idempotency — try externalReference first, then transactionId
    let txR = await client.query(
      `SELECT id, user_id, status, amount_cents FROM transactions 
       WHERE provider_ref = $1 AND type = 'deposit' LIMIT 1 FOR UPDATE`,
      [externalReference || transactionId]
    );

    if (!txR.rows[0] && externalReference) {
      txR = await client.query(
        `SELECT id, user_id, status, amount_cents FROM transactions 
         WHERE provider_ref = $1 AND type = 'deposit' LIMIT 1 FOR UPDATE`,
        [transactionId]
      );
    }
    const tx = txR.rows[0];

    if (!tx) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, msg: 'Transação não encontrada.' });
    }

    if (tx.status === 'paid') {
      await client.query('COMMIT');
      return res.json({ ok: true, already_paid: true, tx_id: tx.id });
    }

    // Amount mismatch guard
    if (amount > 0 && parseInt(tx.amount_cents) !== amount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, msg: 'Valor divergente.' });
    }

    // Mark paid + save payload
    await client.query(
      "UPDATE transactions SET status = 'paid', payload_json = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(req.body), tx.id]
    );

    // Credit wallet
    await client.query(
      'UPDATE wallets SET balance_cents = balance_cents + $1, updated_at = NOW() WHERE user_id = $2',
      [parseInt(tx.amount_cents), tx.user_id]
    );

    // ── Affiliate commission (CPA model only) ─────────────────────
    // If commission_type='revshare', deposit-based commissions are skipped
    // and the affiliate earns only via RevShare on bet losses.
    try {
      const modeR = await client.query("SELECT value FROM platform_settings WHERE key = 'aff_commission_type' LIMIT 1");
      const commMode = (modeR.rows[0]?.value || 'revshare').toLowerCase();
      if (commMode !== 'cpa') {
        // RevShare mode — skip deposit commission
      } else {
      const refR = await client.query('SELECT referred_by FROM users WHERE id = $1', [tx.user_id]);
      const referredBy = refR.rows[0]?.referred_by;
      if (referredBy) {
        const affR = await client.query(
          'SELECT id, commission_pct, is_active FROM affiliates WHERE user_id = $1 LIMIT 1',
          [referredBy]
        );
        const aff = affR.rows[0];
        if (aff && aff.is_active) {
          // Load min deposit + flat bonus
          const setR = await client.query("SELECT key, value FROM platform_settings WHERE key IN ('aff_min_deposit','aff_referral_bonus')");
          const sMap = {}; setR.rows.forEach(r => { sMap[r.key] = r.value; });
          const minDep = parseInt(sMap.aff_min_deposit || '0', 10);
          const flatBonus = parseInt(sMap.aff_referral_bonus || '0', 10);
          const amtCents = parseInt(tx.amount_cents);
          if (!minDep || amtCents >= minDep) {
            // CPA: pay flat bonus once per referred user (on first qualifying deposit)
            const already = await client.query(
              "SELECT id FROM affiliate_commissions WHERE affiliate_id = $1 AND referred_user_id = $2 AND type = 'deposit' LIMIT 1",
              [aff.id, tx.user_id]
            );
            if (!already.rows.length && flatBonus > 0) {
              await client.query(
                `INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, transaction_id, amount_cents, status, type)
                 VALUES ($1, $2, $3, $4, 'pending', 'deposit')`,
                [aff.id, tx.user_id, tx.id, flatBonus]
              );
            }
          }
        }
      }
      }
    } catch (affErr) {
      console.error('[WEBHOOK][AFF]', affErr);
      // Do NOT rollback for affiliate errors — deposit is credited regardless
    }

    await client.query('COMMIT');
    res.json({ ok: true, credited: true, tx_id: tx.id, transactionId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WEBHOOK]', err);
    res.status(500).json({ ok: false, msg: 'Erro interno.' });
  } finally {
    client.release();
  }
});

module.exports = router;
