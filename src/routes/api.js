const router = require('express').Router();
const bcrypt = require('bcrypt');
const { query, pool } = require('../config/database');
const { requireUser } = require('../middleware/auth');
const { createSale } = require('../services/blackcat');

// ─── Auth ─────────────────────────────────────────

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, phone, cpf, email, name, birth_date } = req.body;
    const user = (username || email || '').trim();
    const pass = password || '';
    const ph = (phone || '').trim();
    const cleanCpf = (cpf || '').replace(/\D/g, '');
    const cleanEmail = (email || '').trim();
    const cleanName = (name || '').trim();

    if (!user || user.length < 3 || user.length > 64) {
      return res.status(400).json({ ok: false, msg: 'E-mail deve ter pelo menos 3 caracteres.' });
    }
    if (pass.length < 6 || pass.length > 64) {
      return res.status(400).json({ ok: false, msg: 'Senha deve ter 6-64 caracteres.' });
    }
    if (ph && ph.length < 8) {
      return res.status(400).json({ ok: false, msg: 'Telefone inválido.' });
    }

    // Check duplicate CPF
    if (cleanCpf) {
      const cpfExists = await query('SELECT id FROM users WHERE cpf = $1', [cleanCpf]);
      if (cpfExists.rows.length) {
        return res.status(409).json({ ok: false, msg: 'CPF já cadastrado.' });
      }
    }

    // Check duplicate email/username
    const exists = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [user, cleanEmail || user]);
    if (exists.rows.length) {
      return res.status(409).json({ ok: false, msg: 'E-mail já cadastrado.' });
    }

    const hash = await bcrypt.hash(pass, 10);
    const r = await query(
      `INSERT INTO users (username, name, phone, email, cpf, birth_date, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, name, phone, email, cpf`,
      [user, cleanName || null, ph || null, cleanEmail || null, cleanCpf || null, birth_date || null, hash]
    );
    const u = r.rows[0];

    // Create wallet
    await query('INSERT INTO wallets (user_id, balance_cents) VALUES ($1, 0) ON CONFLICT DO NOTHING', [u.id]);

    req.session.user = u;

    // Record login history
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    query('INSERT INTO login_history (user_id, ip, city, state, coords, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
      [u.id, ip.split(',')[0].trim(), '', '', '', req.headers['user-agent'] || '']
    ).catch(e => console.error('[LOGIN_HISTORY]', e));

    req.session.save((saveErr) => {
      if (saveErr) console.error('[REGISTER] session save:', saveErr);
      res.json({ ok: true, user: u });
    });
  } catch (err) {
    console.error('[REGISTER]', err);
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, msg: 'E-mail ou CPF já cadastrado.' });
    }
    res.status(500).json({ ok: false, msg: 'Erro ao registrar.' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const login = (req.body.login || req.body.username || '').trim();
    const password = req.body.password || '';
    if (!login || !password) {
      return res.status(400).json({ ok: false, msg: 'Preencha todos os campos.' });
    }

    const r = await query(
      'SELECT id, username, name, phone, email, cpf, password_hash, balance FROM users WHERE username = $1 OR email = $1 OR cpf = $2',
      [login, login.replace(/\D/g, '')]
    );
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).json({ ok: false, msg: 'Usuário ou senha inválidos.' });
    }

    delete u.password_hash;
    req.session.user = u;

    // Record login history
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    query('INSERT INTO login_history (user_id, ip, city, state, coords, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
      [u.id, ip.split(',')[0].trim(), '', '', '', req.headers['user-agent'] || '']
    ).catch(e => console.error('[LOGIN_HISTORY]', e));

    req.session.save((saveErr) => {
      if (saveErr) console.error('[LOGIN] session save:', saveErr);
      res.json({ ok: true, user: u });
    });
  } catch (err) {
    console.error('[LOGIN]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao fazer login.' });
  }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/check-cpf
router.get('/check-cpf', async (req, res) => {
  const cpf = (req.query.cpf || '').replace(/\D/g, '');
  if (!cpf || cpf.length !== 11) return res.json({ exists: false });
  try {
    const r = await query('SELECT id FROM users WHERE cpf = $1', [cpf]);
    res.json({ exists: r.rows.length > 0 });
  } catch (e) {
    res.json({ exists: false });
  }
});

// GET /api/me
router.get('/me', async (req, res) => {
  if (!req.session.user) return res.json({ ok: true, logged: false });
  try {
    const r = await query(
      `SELECT id, username, name, phone, email, cpf, birth_date, address_cep, address_street, address_city, address_state, pix_type, pix_key, avatar_url,
              limit_deposit_type, limit_deposit_period, limit_deposit_amount,
              limit_bet_type, limit_bet_period, limit_bet_amount,
              limit_loss_type, limit_loss_period, limit_loss_amount,
              limit_time_type, limit_time_period, limit_time_value
       FROM users WHERE id = $1`,
      [req.session.user.id]
    );
    const u = r.rows[0] || req.session.user;
    req.session.user = u;
    res.json({ ok: true, logged: true, user: u });
  } catch (e) {
    res.json({ ok: true, logged: true, user: req.session.user });
  }
});

// ─── Wallet ───────────────────────────────────────

// GET /api/wallet
router.get('/wallet', requireUser, async (req, res) => {
  try {
    const r = await query('SELECT balance_cents FROM wallets WHERE user_id = $1', [req.session.user.id]);
    const cents = parseInt(r.rows[0]?.balance_cents || 0);
    res.json({ ok: true, logged: true, balance_cents: cents, balance_brl: (cents / 100).toFixed(2) });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao buscar saldo.' });
  }
});

// ─── Deposit ──────────────────────────────────────

// POST /api/deposit/create
router.post('/deposit/create', requireUser, async (req, res) => {
  try {
    const amountBrl = parseFloat(req.body.amount_brl);
    if (isNaN(amountBrl) || amountBrl < 30 || amountBrl > 50000) {
      return res.status(400).json({ ok: false, msg: 'Valor deve ser entre R$30 e R$50.000.' });
    }

    const amountCents = Math.round(amountBrl * 100);
    const user = req.session.user;

    // 1) Create pending transaction
    const txR = await query(
      `INSERT INTO transactions (user_id, type, status, amount_cents, provider) 
       VALUES ($1, 'deposit', 'pending', $2, 'blackcat') RETURNING id`,
      [user.id, amountCents]
    );
    const txId = txR.rows[0].id;
    const externalRef = String(txId);

    await query('UPDATE transactions SET provider_ref = $1 WHERE id = $2', [externalRef, txId]);

    // 2) Call BlackCat
    let resp;
    try {
      resp = await createSale(amountCents, 'Deposito', user, externalRef);
    } catch (apiErr) {
      console.error('[DEPOSIT] BlackCat API error:', apiErr.message);
      await query("UPDATE transactions SET status = 'failed', payload_json = $1 WHERE id = $2", [JSON.stringify({ error: apiErr.message }), txId]);
      return res.status(502).json({ ok: false, msg: 'Erro no gateway: ' + apiErr.message });
    }

    // Save payload
    await query('UPDATE transactions SET payload_json = $1 WHERE id = $2', [JSON.stringify(resp), txId]);

    const data = resp.data || resp;
    const providerTxId = data.transactionId || data.id;
    const paymentData = data.paymentData || {};
    const copyPaste = paymentData.pixCode || paymentData.copyPaste || paymentData.qrCode || null;
    const qrBase64 = paymentData.qrCodeBase64 || paymentData.qrCodeImage || null;

    if (!providerTxId || !copyPaste) {
      console.error('[DEPOSIT] Gateway response missing pix data:', JSON.stringify(resp).substring(0, 500));
      await query("UPDATE transactions SET status = 'failed' WHERE id = $1", [txId]);
      return res.status(502).json({ ok: false, msg: 'Gateway não retornou código PIX.' });
    }

    // Update provider_ref with actual transactionId from gateway
    await query('UPDATE transactions SET provider_ref = $1 WHERE id = $2', [String(providerTxId), txId]);

    res.json({
      ok: true,
      tx_id: txId,
      externalReference: externalRef,
      transactionId: String(providerTxId),
      amount_cents: amountCents,
      copyPaste: String(copyPaste),
      invoiceUrl: String(data.invoiceUrl || ''),
      qrCodeBase64: qrBase64 ? String(qrBase64) : null
    });
  } catch (err) {
    console.error('[DEPOSIT] Unexpected error:', err);
    res.status(500).json({ ok: false, msg: 'Erro interno ao processar depósito.' });
  }
});

// GET /api/deposit/status?tx_id=X
router.get('/deposit/status', requireUser, async (req, res) => {
  try {
    const txId = parseInt(req.query.tx_id);
    if (!txId) return res.status(400).json({ ok: false, msg: 'tx_id obrigatório.' });

    const r = await query(
      'SELECT id, status FROM transactions WHERE id = $1 AND user_id = $2',
      [txId, req.session.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ ok: false, msg: 'Transação não encontrada.' });

    const status = r.rows[0].status.toLowerCase();
    res.json({ ok: true, tx_id: r.rows[0].id, status, paid: status === 'paid' });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao verificar status.' });
  }
});

// ─── Games ────────────────────────────────────────

// GET /api/games
router.get('/games', async (req, res) => {
  try {
    const cat = req.query.category || '';
    let sql = 'SELECT id, game_code, game_name, image_url, provider, category, is_featured, featured_order FROM games WHERE is_active = TRUE';
    const params = [];

    if (cat) {
      sql += ' AND category = $1';
      params.push(cat);
    }

    sql += ' ORDER BY is_featured DESC NULLS LAST, featured_order ASC NULLS LAST, sort_order, id DESC';

    const r = await query(sql, params);
    res.json({ ok: true, games: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao buscar jogos.' });
  }
});

// POST /api/game/launch — Launch a PlayFivers game
router.post('/game/launch', requireUser, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { game_code } = req.body;
    if (!game_code) return res.status(400).json({ ok: false, msg: 'game_code obrigatório.' });

    // Fetch game info
    const gameR = await query(
      'SELECT id, game_code, game_name, pf_game_code, pf_provider, game_original FROM games WHERE game_code = $1 AND is_active = TRUE',
      [game_code]
    );
    if (!gameR.rows.length) return res.status(404).json({ ok: false, msg: 'Jogo não encontrado.' });
    const game = gameR.rows[0];

    if (!game.pf_game_code || !game.pf_provider) {
      return res.status(400).json({ ok: false, msg: 'Jogo não integrado com provedor.' });
    }

    // Get user balance (cents → reais)
    const walletR = await query('SELECT balance_cents FROM wallets WHERE user_id = $1', [userId]);
    const balanceCents = walletR.rows[0] ? parseInt(walletR.rows[0].balance_cents) : 0;
    const balanceReais = parseFloat((balanceCents / 100).toFixed(2));

    // User code for PlayFivers = unique identifier (email or id)
    const userCode = req.session.user.email || req.session.user.username || String(userId);

    const pf = require('../services/playfivers');
    const result = await pf.launchGame({
      userCode,
      gameCode: game.pf_game_code,
      provider: game.pf_provider,
      gameOriginal: game.game_original,
      userBalance: balanceReais,
      lang: 'pt'
    });

    if (result.status !== 200 || !result.data.status || !result.data.launch_url) {
      console.error('[GAME LAUNCH] PlayFivers error:', result.data);
      return res.status(502).json({ ok: false, msg: result.data.msg || 'Erro ao iniciar jogo.' });
    }

    res.json({ ok: true, launch_url: result.data.launch_url, game_name: game.game_name });
  } catch (err) {
    console.error('[GAME LAUNCH]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao iniciar jogo.' });
  }
});

// GET /api/banners
router.get('/banners', async (req, res) => {
  try {
    const r = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    res.json({ ok: true, banners: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro ao buscar banners.' });
  }
});

// ─── User Account ─────────────────────────────────

// GET /api/user/login-history
router.get('/user/login-history', requireUser, async (req, res) => {
  try {
    const r = await query(
      'SELECT ip, city, state, coords, created_at FROM login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.session.user.id]
    );
    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    console.error('[LOGIN_HISTORY]', err);
    res.json({ ok: true, rows: [] });
  }
});

// POST /api/user/update-phone
router.post('/user/update-phone', requireUser, async (req, res) => {
  try {
    const phone = (req.body.phone || '').trim();
    if (!phone || phone.length < 8) return res.status(400).json({ ok: false, msg: 'Telefone inválido.' });
    await query('UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2', [phone, req.session.user.id]);
    req.session.user.phone = phone;
    req.session.save(() => {});
    res.json({ ok: true, msg: 'Celular atualizado!', phone });
  } catch (err) {
    console.error('[UPDATE_PHONE]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar celular.' });
  }
});

// POST /api/user/update-address
router.post('/user/update-address', requireUser, async (req, res) => {
  try {
    const { cep, street, city, state } = req.body;
    await query(
      'UPDATE users SET address_cep = $1, address_street = $2, address_city = $3, address_state = $4, updated_at = NOW() WHERE id = $5',
      [cep || '', street || '', city || '', state || '', req.session.user.id]
    );
    req.session.user.address_cep = cep;
    req.session.user.address_street = street;
    req.session.user.address_city = city;
    req.session.user.address_state = state;
    req.session.save(() => {});
    res.json({ ok: true, msg: 'Endereço atualizado!' });
  } catch (err) {
    console.error('[UPDATE_ADDRESS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar endereço.' });
  }
});

// POST /api/user/update-pix
router.post('/user/update-pix', requireUser, async (req, res) => {
  try {
    const { pix_type, pix_key } = req.body;
    if (!pix_key) return res.status(400).json({ ok: false, msg: 'Informe a chave PIX.' });
    await query('UPDATE users SET pix_type = $1, pix_key = $2, updated_at = NOW() WHERE id = $3',
      [pix_type || 'cpf', pix_key, req.session.user.id]);
    req.session.user.pix_type = pix_type;
    req.session.user.pix_key = pix_key;
    req.session.save(() => {});
    res.json({ ok: true, msg: 'Chave PIX atualizada!' });
  } catch (err) {
    console.error('[UPDATE_PIX]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao atualizar PIX.' });
  }
});

// POST /api/user/upload-avatar
router.post('/user/upload-avatar', requireUser, async (req, res) => {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) return res.status(400).json({ ok: false, msg: 'Nenhuma imagem enviada.' });
    // Validate it's a data URI (base64 image) and limit size (~2MB in base64)
    if (!avatar_url.startsWith('data:image/') || avatar_url.length > 2800000) {
      return res.status(400).json({ ok: false, msg: 'Imagem inválida ou muito grande.' });
    }
    await query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [avatar_url, req.session.user.id]);
    req.session.user.avatar_url = avatar_url;
    req.session.save(() => {});
    res.json({ ok: true, msg: 'Foto atualizada!' });
  } catch (err) {
    console.error('[UPLOAD_AVATAR]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao salvar foto.' });
  }
});

// POST /api/user/remove-avatar
router.post('/user/remove-avatar', requireUser, async (req, res) => {
  try {
    await query('UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1', [req.session.user.id]);
    req.session.user.avatar_url = null;
    req.session.save(() => {});
    res.json({ ok: true, msg: 'Foto removida!' });
  } catch (err) {
    console.error('[REMOVE_AVATAR]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao remover foto.' });
  }
});

// POST /api/user/change-password
router.post('/user/change-password', requireUser, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ ok: false, msg: 'Preencha todos os campos.' });
    }
    if (new_password.length < 6 || new_password.length > 16) {
      return res.status(400).json({ ok: false, msg: 'Nova senha deve ter 6-16 caracteres.' });
    }

    const r = await query('SELECT password_hash FROM users WHERE id = $1', [req.session.user.id]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, msg: 'Usuário não encontrado.' });

    const valid = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!valid) return res.status(401).json({ ok: false, msg: 'Senha atual incorreta.' });

    const hash = await bcrypt.hash(new_password, 10);
    const upd = await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id', [hash, req.session.user.id]);
    if (!upd.rows.length) return res.status(500).json({ ok: false, msg: 'Erro ao salvar nova senha.' });
    console.log('[CHANGE_PASSWORD] Updated user', req.session.user.id);

    res.json({ ok: true, msg: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('[CHANGE_PASSWORD]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao alterar senha.' });
  }
});

// POST /api/user/update-limits
router.post('/user/update-limits', requireUser, async (req, res) => {
  try {
    const { limit_deposit_type, limit_deposit_period, limit_deposit_amount,
            limit_bet_type, limit_bet_period, limit_bet_amount,
            limit_loss_type, limit_loss_period, limit_loss_amount,
            limit_time_type, limit_time_period, limit_time_value } = req.body;
    await query(`UPDATE users SET
      limit_deposit_type=$1, limit_deposit_period=$2, limit_deposit_amount=$3,
      limit_bet_type=$4, limit_bet_period=$5, limit_bet_amount=$6,
      limit_loss_type=$7, limit_loss_period=$8, limit_loss_amount=$9,
      limit_time_type=$10, limit_time_period=$11, limit_time_value=$12,
      updated_at=NOW() WHERE id=$13`,
      [limit_deposit_type||'unlimited', limit_deposit_period||null, parseInt(limit_deposit_amount)||0,
       limit_bet_type||'unlimited', limit_bet_period||null, parseInt(limit_bet_amount)||0,
       limit_loss_type||'unlimited', limit_loss_period||null, parseInt(limit_loss_amount)||0,
       limit_time_type||'unlimited', limit_time_period||null, limit_time_value||null,
       req.session.user.id]);
    res.json({ ok: true, msg: 'Limites atualizados!' });
  } catch (err) {
    console.error('[UPDATE_LIMITS]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao salvar limites.' });
  }
});

// GET /api/user/limits
router.get('/user/limits', requireUser, async (req, res) => {
  try {
    const r = await query(
      `SELECT limit_deposit_type, limit_deposit_period, limit_deposit_amount,
              limit_bet_type, limit_bet_period, limit_bet_amount,
              limit_loss_type, limit_loss_period, limit_loss_amount,
              limit_time_type, limit_time_period, limit_time_value
       FROM users WHERE id = $1`, [req.session.user.id]);
    res.json({ ok: true, limits: r.rows[0] || {} });
  } catch (err) {
    console.error('[GET_LIMITS]', err);
    res.json({ ok: true, limits: {} });
  }
});

// POST /api/withdrawal/create
router.post('/withdrawal/create', requireUser, async (req, res) => {
  try {
    const amountBrl = parseFloat(req.body.amount_brl);
    if (isNaN(amountBrl) || amountBrl < 10) {
      return res.status(400).json({ ok: false, msg: 'Valor mínimo para saque: R$ 10,00.' });
    }
    const amountCents = Math.round(amountBrl * 100);

    // Check balance
    const wR = await query('SELECT balance_cents FROM wallets WHERE user_id = $1', [req.session.user.id]);
    const balance = parseInt(wR.rows[0]?.balance_cents || 0);
    if (amountCents > balance) {
      return res.status(400).json({ ok: false, msg: 'Saldo insuficiente.' });
    }

    const pixType = req.body.pix_type || 'cpf';
    const pixKey = (req.body.pix_key || '').trim();
    if (!pixKey) return res.status(400).json({ ok: false, msg: 'Informe a chave PIX.' });

    // Check pending withdrawals
    const pending = await query("SELECT id FROM withdrawals WHERE user_id=$1 AND status='pending'", [req.session.user.id]);
    if (pending.rows.length >= 3) {
      return res.status(400).json({ ok: false, msg: 'Você já tem 3 saques pendentes. Aguarde a aprovação.' });
    }

    const r = await query(
      'INSERT INTO withdrawals (user_id, amount_cents, pix_type, pix_key) VALUES ($1,$2,$3,$4) RETURNING id',
      [req.session.user.id, amountCents, pixType, pixKey]);

    res.json({ ok: true, msg: 'Saque solicitado! Aguarde aprovação.', withdrawal_id: r.rows[0].id });
  } catch (err) {
    console.error('[WITHDRAWAL_CREATE]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao solicitar saque.' });
  }
});

// GET /api/user/withdrawals
router.get('/user/withdrawals', requireUser, async (req, res) => {
  try {
    const r = await query(
      'SELECT id, amount_cents, pix_type, pix_key, status, created_at FROM withdrawals WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.session.user.id]);
    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    console.error('[GET_WITHDRAWALS]', err);
    res.json({ ok: true, rows: [] });
  }
});

// GET /api/user/transactions
router.get('/user/transactions', requireUser, async (req, res) => {
  try {
    const type = req.query.type || 'all';
    const period = req.query.period || 'total';
    let dateFilter = '';
    if (period === 'today') dateFilter = "AND t.created_at >= CURRENT_DATE";
    else if (period === 'yesterday') dateFilter = "AND t.created_at >= CURRENT_DATE - INTERVAL '1 day' AND t.created_at < CURRENT_DATE";
    else if (period === '7d') dateFilter = "AND t.created_at >= NOW() - INTERVAL '7 days'";
    else if (period === '30d') dateFilter = "AND t.created_at >= NOW() - INTERVAL '30 days'";
    else if (period === '90d') dateFilter = "AND t.created_at >= NOW() - INTERVAL '90 days'";

    let typeFilter = '';
    if (type === 'deposit') typeFilter = "AND t.type = 'deposit'";
    else if (type === 'withdrawal') typeFilter = "AND t.type = 'withdrawal'";
    else if (type === 'coupon') typeFilter = "AND t.type = 'coupon'";
    else if (type === 'bonus') typeFilter = "AND t.type = 'bonus'";

    const sql = `SELECT t.id, t.type, t.status, t.amount_cents, t.provider, t.provider_ref, t.created_at
                 FROM transactions t
                 WHERE t.user_id = $1 ${typeFilter} ${dateFilter}
                 ORDER BY t.created_at DESC LIMIT 100`;
    const r = await query(sql, [req.session.user.id]);

    // Also get withdrawals mapped as transactions
    let withdrawals = [];
    if (type === 'all' || type === 'withdrawal') {
      const wSql = `SELECT id, amount_cents, pix_type as provider, status, created_at
                     FROM withdrawals WHERE user_id = $1 ${dateFilter.replace(/t\./g, '')}
                     ORDER BY created_at DESC LIMIT 50`;
      const wR = await query(wSql, [req.session.user.id]);
      withdrawals = wR.rows.map(w => ({ ...w, type: 'withdrawal', provider_ref: 'W-' + w.id }));
    }

    const all = [...r.rows, ...withdrawals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ ok: true, rows: all });
  } catch (err) {
    console.error('[GET_TRANSACTIONS]', err);
    res.json({ ok: true, rows: [] });
  }
});

// GET /api/deposit/status?tx_id=123
router.get('/deposit/status', requireUser, async (req, res) => {
  try {
    const txId = parseInt(req.query.tx_id);
    if (!txId) return res.status(400).json({ ok: false, msg: 'tx_id obrigatório.' });
    const r = await query(
      'SELECT status, amount_cents FROM transactions WHERE id = $1 AND user_id = $2',
      [txId, req.session.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ ok: false, msg: 'Transação não encontrada.' });
    res.json({ ok: true, status: r.rows[0].status, amount_cents: r.rows[0].amount_cents });
  } catch (err) {
    console.error('[DEPOSIT_STATUS]', err);
    res.status(500).json({ ok: false, msg: 'Erro interno.' });
  }
});

// ─── Notifications ─────────────────────────────────

// GET /api/notifications — list (user-specific + broadcasts)
router.get('/notifications', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;
    const r = await query(
      `SELECT * FROM notifications WHERE user_id = $1 OR user_id = 0
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [uid, limit, offset]
    );
    const c = await query(
      `SELECT COUNT(*) as total FROM notifications WHERE (user_id = $1 OR user_id = 0) AND lida = FALSE`,
      [uid]
    );
    res.json({ ok: true, notifications: r.rows, unread: parseInt(c.rows[0].total) });
  } catch (err) {
    console.error('[NOTIF_LIST]', err);
    res.status(500).json({ ok: false, msg: 'Erro interno.' });
  }
});

// GET /api/notifications/count — unread count
router.get('/notifications/count', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const c = await query(
      `SELECT COUNT(*) as total FROM notifications WHERE (user_id = $1 OR user_id = 0) AND lida = FALSE`,
      [uid]
    );
    res.json({ ok: true, unread: parseInt(c.rows[0].total) });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro interno.' });
  }
});

// POST /api/notifications/read — mark single as read
router.post('/notifications/read', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const id = parseInt(req.body.id);
    if (!id) return res.status(400).json({ ok: false, msg: 'ID obrigatório.' });
    await query(
      `UPDATE notifications SET lida = TRUE WHERE id = $1 AND (user_id = $2 OR user_id = 0)`,
      [id, uid]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro interno.' });
  }
});

// POST /api/notifications/read-all — mark all as read
router.post('/notifications/read-all', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    await query(
      `UPDATE notifications SET lida = TRUE WHERE (user_id = $1 OR user_id = 0) AND lida = FALSE`,
      [uid]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, msg: 'Erro interno.' });
  }
});

// GET /api/diag/playfivers — Debug PlayFivers config (admin only, temporary)
router.get('/diag/playfivers', async (req, res) => {
  try {
    const pf = require('../services/playfivers');
    const agentR = await pf.getAgent();
    const balR = await pf.getBalances();

    // Also check user wallet
    const userCode = req.query.user;
    let userWallet = null;
    if (userCode) {
      const uR = await query(
        'SELECT u.id, u.username, u.email, w.balance_cents FROM users u JOIN wallets w ON w.user_id = u.id WHERE u.email = $1 OR u.username = $1 LIMIT 1',
        [userCode]
      );
      if (uR.rows[0]) {
        userWallet = {
          id: uR.rows[0].id,
          username: uR.rows[0].username,
          email: uR.rows[0].email,
          balance_cents: parseInt(uR.rows[0].balance_cents),
          balance_reais: parseFloat((parseInt(uR.rows[0].balance_cents) / 100).toFixed(2))
        };
      }
    }

    res.json({
      ok: true,
      agent: agentR.data,
      balances: balR.data,
      userWallet
    });
  } catch (err) {
    console.error('[DIAG]', err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

module.exports = router;
