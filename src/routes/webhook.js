const router = require('express').Router();
const { pool, query } = require('../config/database');

// POST /api/webhook/blackcat
router.post('/blackcat', async (req, res) => {
  const { transactionId, status, amount, externalReference } = req.body;

  if (!transactionId || !status || !externalReference) {
    return res.status(400).json({ ok: false, msg: 'Campos obrigatórios ausentes.' });
  }

  if (status.toUpperCase() !== 'PAID') {
    return res.json({ ok: true, ignored: true, status });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock row for idempotency
    const txR = await client.query(
      `SELECT id, user_id, status, amount_cents FROM transactions 
       WHERE provider_ref = $1 AND type = 'deposit' LIMIT 1 FOR UPDATE`,
      [externalReference]
    );
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
