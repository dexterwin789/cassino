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

    // Resolve referral (session has priority; fallback to body.ref)
    let referredById = null;
    const refRaw = (req.session && req.session.pendingRef) || (req.body && req.body.ref) || '';
    const refStr = String(refRaw).trim();
    if (refStr) {
      // Try affiliate code (string) first
      const byCode = await query('SELECT user_id FROM affiliates WHERE code = $1 AND is_active = TRUE LIMIT 1', [refStr]);
      if (byCode.rows.length) {
        referredById = byCode.rows[0].user_id;
      } else if (/^\d+$/.test(refStr)) {
        // Fallback: numeric user_id
        const byId = await query('SELECT id FROM users WHERE id = $1 LIMIT 1', [parseInt(refStr, 10)]);
        if (byId.rows.length) referredById = byId.rows[0].id;
      }
    }

    const r = await query(
      `INSERT INTO users (username, name, phone, email, cpf, birth_date, password_hash, referred_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, name, phone, email, cpf`,
      [user, cleanName || null, ph || null, cleanEmail || null, cleanCpf || null, birth_date || null, hash, referredById]
    );
    const u = r.rows[0];

    // Create wallet
    await query('INSERT INTO wallets (user_id, balance_cents) VALUES ($1, 0) ON CONFLICT DO NOTHING', [u.id]);

    req.session.user = u;
    if (req.session.pendingRef) delete req.session.pendingRef;

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
      `SELECT u.id, u.username, u.name, u.phone, u.email, u.cpf, u.password_hash,
              COALESCE(w.balance_cents, 0) AS wallet_balance_cents
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.username = $1 OR u.email = $1 OR u.cpf = $2`,
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
    // Timezone-aware filters (America/Sao_Paulo). Server runs UTC but users are BR.
    const brToday = "((NOW() AT TIME ZONE 'America/Sao_Paulo')::date)";
    const brDate = (col) => `((${col} AT TIME ZONE 'America/Sao_Paulo')::date)`;
    let dateFilter = '';
    if (period === 'today') dateFilter = `AND ${brDate('t.created_at')} = ${brToday}`;
    else if (period === 'yesterday') dateFilter = `AND ${brDate('t.created_at')} = ${brToday} - INTERVAL '1 day'`;
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

// GET /api/user/bets?period=today|yesterday|7d|30d|90d|total&kind=casino|sport
router.get('/user/bets', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const period = (req.query.period || 'total').toString();
    const kind = (req.query.kind || 'casino').toString();
    const brToday = "((NOW() AT TIME ZONE 'America/Sao_Paulo')::date)";
    const brDate = (col) => `((${col} AT TIME ZONE 'America/Sao_Paulo')::date)`;
    let dateFilter = '';
    if (period === 'today') dateFilter = `AND ${brDate('b.created_at')} = ${brToday}`;
    else if (period === 'yesterday') dateFilter = `AND ${brDate('b.created_at')} = ${brToday} - INTERVAL '1 day'`;
    else if (period === '7d') dateFilter = "AND b.created_at >= NOW() - INTERVAL '7 days'";
    else if (period === '30d') dateFilter = "AND b.created_at >= NOW() - INTERVAL '30 days'";
    else if (period === '90d') dateFilter = "AND b.created_at >= NOW() - INTERVAL '90 days'";

    // Cassino bets come from `bets` table (with a game_id). Sports bets have
    // no game_id (or could live in a separate table in the future).
    const kindFilter = kind === 'sport' ? 'AND b.game_id IS NULL' : 'AND b.game_id IS NOT NULL';

    const r = await query(`
      SELECT b.id, b.game_id, b.amount_cents, b.payout_cents, b.multiplier,
             b.status, b.created_at,
             g.game_name AS game_name, g.provider AS game_provider
      FROM bets b
      LEFT JOIN games g ON g.id = b.game_id
      WHERE b.user_id = $1 ${kindFilter} ${dateFilter}
      ORDER BY b.created_at DESC
      LIMIT 200
    `, [uid]);

    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    console.error('[GET_USER_BETS]', err);
    res.json({ ok: true, rows: [] });
  }
});

// GET /api/user/statement?period=...  — Extrato completo (todas movimentações)
router.get('/user/statement', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const period = (req.query.period || 'total').toString();
    const brToday = "((NOW() AT TIME ZONE 'America/Sao_Paulo')::date)";
    const brDate = (col) => `((${col} AT TIME ZONE 'America/Sao_Paulo')::date)`;
    const dateExpr = (col) => {
      if (period === 'today') return `AND ${brDate(col)} = ${brToday}`;
      if (period === 'yesterday') return `AND ${brDate(col)} = ${brToday} - INTERVAL '1 day'`;
      if (period === '7d') return `AND ${col} >= NOW() - INTERVAL '7 days'`;
      if (period === '30d') return `AND ${col} >= NOW() - INTERVAL '30 days'`;
      if (period === '90d') return `AND ${col} >= NOW() - INTERVAL '90 days'`;
      return '';
    };

    const [txR, betR, wR] = await Promise.all([
      query(`SELECT id, type, status, amount_cents, provider, created_at
             FROM transactions WHERE user_id = $1 ${dateExpr('created_at')}
             ORDER BY created_at DESC LIMIT 200`, [uid]),
      query(`SELECT b.id, b.amount_cents, b.payout_cents, b.status, b.created_at,
                    g.game_name AS game_name
             FROM bets b LEFT JOIN games g ON g.id = b.game_id
             WHERE b.user_id = $1 ${dateExpr('b.created_at')}
             ORDER BY b.created_at DESC LIMIT 200`, [uid]),
      query(`SELECT id, amount_cents, status, created_at
             FROM withdrawals WHERE user_id = $1 ${dateExpr('created_at')}
             ORDER BY created_at DESC LIMIT 100`, [uid])
    ]);

    const rows = [];
    txR.rows.forEach(t => rows.push({
      kind: t.type === 'deposit' ? 'Depósito' : (t.type === 'bonus' ? 'Bônus' : t.type),
      id: 'T-' + t.id,
      desc: (t.provider || '').toUpperCase() || '—',
      amount_cents: t.amount_cents,
      status: t.status,
      created_at: t.created_at,
      positive: t.type !== 'withdrawal'
    }));
    betR.rows.forEach(b => {
      rows.push({
        kind: 'Aposta',
        id: 'B-' + b.id,
        desc: b.game_name || '—',
        amount_cents: -Math.abs(parseInt(b.amount_cents || 0)),
        status: b.status,
        created_at: b.created_at,
        positive: false
      });
      if (parseInt(b.payout_cents || 0) > 0) {
        rows.push({
          kind: 'Prêmio',
          id: 'P-' + b.id,
          desc: b.game_name || '—',
          amount_cents: parseInt(b.payout_cents),
          status: 'paid',
          created_at: b.created_at,
          positive: true
        });
      }
    });
    wR.rows.forEach(w => rows.push({
      kind: 'Saque',
      id: 'W-' + w.id,
      desc: 'PIX',
      amount_cents: -Math.abs(parseInt(w.amount_cents || 0)),
      status: w.status,
      created_at: w.created_at,
      positive: false
    }));
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ ok: true, rows: rows.slice(0, 300) });
  } catch (err) {
    console.error('[GET_STATEMENT]', err);
    res.json({ ok: true, rows: [] });
  }
});

// GET /api/referrals/leads — homepage widget list
router.get('/referrals/leads', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const period = (req.query.period || 'all').toString();
    const brToday = "((NOW() AT TIME ZONE 'America/Sao_Paulo')::date)";
    const brDate = (col) => `((${col} AT TIME ZONE 'America/Sao_Paulo')::date)`;
    let dateFilter = '';
    if (period === 'today') dateFilter = `AND ${brDate('u.created_at')} = ${brToday}`;
    else if (period === 'yesterday') dateFilter = `AND ${brDate('u.created_at')} = ${brToday} - INTERVAL '1 day'`;
    else if (period === '7d') dateFilter = "AND u.created_at >= NOW() - INTERVAL '7 days'";
    else if (period === '30d') dateFilter = "AND u.created_at >= NOW() - INTERVAL '30 days'";
    else if (period === '90d') dateFilter = "AND u.created_at >= NOW() - INTERVAL '90 days'";

    const r = await query(`
      SELECT u.id, u.username, u.name, u.email, u.created_at,
        COALESCE((SELECT SUM(amount_cents) FROM transactions WHERE user_id = u.id AND status = 'paid' AND type IN ('deposit','pix_in')), 0) AS deposited_cents,
        COALESCE((SELECT COUNT(*)::int FROM bets WHERE user_id = u.id), 0) AS bets_count,
        COALESCE((SELECT SUM(amount_cents) FROM bets WHERE user_id = u.id), 0) AS bets_volume_cents,
        COALESCE((
          SELECT SUM(ac.amount_cents)
          FROM affiliate_commissions ac
          JOIN affiliates a ON a.id = ac.affiliate_id
          WHERE a.user_id = $1 AND ac.referred_user_id = u.id
        ), 0) AS commission_cents,
        COALESCE((
          SELECT SUM(ac.amount_cents)
          FROM affiliate_commissions ac
          JOIN affiliates a ON a.id = ac.affiliate_id
          WHERE a.user_id = $1 AND ac.referred_user_id = u.id AND ac.status = 'paid'
        ), 0) AS commission_paid_cents
      FROM users u
      WHERE u.referred_by = $1 ${dateFilter}
      ORDER BY u.created_at DESC
      LIMIT 500
    `, [uid]);

    const leads = r.rows.map(x => ({
      id: x.id,
      username: x.username,
      name: x.name,
      email: x.email,
      created_at: x.created_at,
      deposited_cents: parseInt(x.deposited_cents || 0),
      bets_count: parseInt(x.bets_count || 0),
      bets_volume_cents: parseInt(x.bets_volume_cents || 0),
      commission_cents: parseInt(x.commission_cents || 0),
      commission_paid_cents: parseInt(x.commission_paid_cents || 0)
    }));
    res.json({ ok: true, leads });
  } catch (err) {
    console.error('[API LEADS]', err);
    res.status(500).json({ ok: false, msg: 'Erro' });
  }
});

// GET /api/affiliate/commissions — detailed commission log for current user
router.get('/affiliate/commissions', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const affR = await query('SELECT id FROM affiliates WHERE user_id = $1 LIMIT 1', [uid]);
    if (!affR.rows.length) return res.json({ ok: true, rows: [] });
    const r = await query(`
      SELECT ac.id, ac.amount_cents, ac.status, ac.type, ac.bet_id, ac.created_at,
             u.username AS from_user
      FROM affiliate_commissions ac
      LEFT JOIN users u ON u.id = ac.referred_user_id
      WHERE ac.affiliate_id = $1
      ORDER BY ac.created_at DESC
      LIMIT $2
    `, [affR.rows[0].id, limit]);
    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    console.error('[AFF COMMISSIONS]', err);
    res.status(500).json({ ok: false, msg: 'Erro' });
  }
});

router.get('/affiliate/me', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    let r = await query(
      `SELECT id, code, commission_pct, total_earned_cents, is_active
       FROM affiliates WHERE user_id = $1 LIMIT 1`, [uid]
    );
    // Auto-criar registro de afiliado se não existir
    if (!r.rows.length) {
      const code = 'VNB' + uid + Math.random().toString(36).slice(2, 6).toUpperCase();
      const pctR = await query(`SELECT value FROM platform_settings WHERE key = 'aff_revshare_pct' LIMIT 1`);
      const pct = parseFloat(pctR.rows[0]?.value || '50');
      r = await query(
        `INSERT INTO affiliates (user_id, code, commission_pct, total_earned_cents, is_active, created_at)
         VALUES ($1, $2, $3, 0, true, NOW()) RETURNING id, code, commission_pct, total_earned_cents, is_active`,
        [uid, code, pct]
      );
    }
    const aff = r.rows[0];
    // Stats agregadas
    const stats = await query(
      `SELECT
        (SELECT COUNT(*)::int FROM users WHERE referred_by = $1) AS total_leads,
        (SELECT COUNT(*)::int FROM users u WHERE u.referred_by = $1
           AND EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = u.id AND t.status='paid' AND t.type IN ('deposit','pix_in'))
        ) AS active_leads,
        (SELECT COALESCE(SUM(amount_cents),0) FROM affiliate_commissions WHERE affiliate_id = $2) AS total_commission,
        (SELECT COALESCE(SUM(amount_cents),0) FROM affiliate_commissions WHERE affiliate_id = $2 AND status = 'paid') AS paid_commission,
        (SELECT COALESCE(SUM(amount_cents),0) FROM affiliate_commissions WHERE affiliate_id = $2 AND status = 'pending') AS pending_commission`,
      [uid, aff.id]
    );
    res.json({
      ok: true,
      code: aff.code,
      commission_pct: parseFloat(aff.commission_pct),
      is_active: aff.is_active,
      total_earned_cents: parseInt(aff.total_earned_cents || 0),
      stats: {
        total_leads: stats.rows[0].total_leads,
        active_leads: stats.rows[0].active_leads,
        total_commission_cents: parseInt(stats.rows[0].total_commission),
        paid_commission_cents: parseInt(stats.rows[0].paid_commission),
        pending_commission_cents: parseInt(stats.rows[0].pending_commission)
      }
    });
  } catch (err) {
    console.error('[AFF ME]', err);
    res.status(500).json({ ok: false, msg: 'Erro' });
  }
});

// ═════════════════════════════════════════════════════════════════════
//  AFFILIATE v3 — Dashboard, Links, Indicados paginated, Withdrawals
// ═════════════════════════════════════════════════════════════════════

// Helper: build period WHERE clause for BRT timezone
function periodClause(alias, col, period, from, to) {
  const brDate = (c) => `((${c} AT TIME ZONE 'America/Sao_Paulo')::date)`;
  const brToday = `((NOW() AT TIME ZONE 'America/Sao_Paulo')::date)`;
  const c = `${alias}.${col}`;
  if (period === 'today') return `AND ${brDate(c)} = ${brToday}`;
  if (period === 'yesterday') return `AND ${brDate(c)} = ${brToday} - INTERVAL '1 day'`;
  if (period === 'week') return `AND ${c} >= NOW() - INTERVAL '7 days'`;
  if (period === 'month') return `AND ${brDate(c)} >= date_trunc('month', ${brToday})`;
  if (period === '7d') return `AND ${c} >= NOW() - INTERVAL '7 days'`;
  if (period === '30d') return `AND ${c} >= NOW() - INTERVAL '30 days'`;
  if (period === '90d') return `AND ${c} >= NOW() - INTERVAL '90 days'`;
  if (period === 'custom' && from && to) {
    return `AND ${brDate(c)} BETWEEN $FROM::date AND $TO::date`;
  }
  return '';
}

async function ensureAffiliate(uid) {
  let r = await query('SELECT id, code, commission_pct, level, parent_id, model FROM affiliates WHERE user_id = $1 LIMIT 1', [uid]);
  if (!r.rows.length) {
    const code = 'VNB' + uid + Math.random().toString(36).slice(2, 6).toUpperCase();
    const pctR = await query("SELECT value FROM platform_settings WHERE key = 'aff_revshare_pct' LIMIT 1");
    const pct = parseFloat(pctR.rows[0]?.value || '50');
    r = await query(
      `INSERT INTO affiliates (user_id, code, commission_pct, total_earned_cents, is_active, level, model, created_at)
       VALUES ($1, $2, $3, 0, TRUE, 1, 'revshare', NOW()) RETURNING id, code, commission_pct, level, parent_id, model`,
      [uid, code, pct]
    );
  }
  return r.rows[0];
}

// GET /api/affiliate/dashboard?period=today|yesterday|week|month|custom&from=&to=
router.get('/affiliate/dashboard', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const aff = await ensureAffiliate(uid);
    const period = (req.query.period || 'today').toString();
    const from = (req.query.from || '').toString();
    const to = (req.query.to || '').toString();

    // Build filters for different joined tables (re-aliased per-query)
    const buildClause = (alias, col) => {
      let c = periodClause(alias, col, period, from, to);
      if (c.includes('$FROM')) {
        return { clause: c.replace('$FROM', "'" + from.replace(/'/g, '') + "'").replace('$TO', "'" + to.replace(/'/g, '') + "'") };
      }
      return { clause: c };
    };

    const uCl = buildClause('u', 'created_at').clause;
    const tCl = buildClause('t', 'created_at').clause;
    const wCl = buildClause('w', 'created_at').clause;
    const acCl = buildClause('ac', 'created_at').clause;

    const r = await query(`
      WITH leads AS (
        SELECT id FROM users WHERE referred_by = $1
      ),
      leads_in_period AS (
        SELECT id FROM users u WHERE u.referred_by = $1 ${uCl}
      ),
      dep AS (
        SELECT COUNT(*)::int AS qty, COALESCE(SUM(t.amount_cents),0) AS tot
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE u.referred_by = $1 AND t.status = 'paid' AND t.type IN ('deposit','pix_in') ${tCl}
      ),
      wd AS (
        SELECT COUNT(*)::int AS qty, COALESCE(SUM(w.amount_cents),0) AS tot
        FROM withdrawals w
        JOIN users u ON u.id = w.user_id
        WHERE u.referred_by = $1 AND w.status IN ('paid','approved','completed') ${wCl}
      ),
      ftd AS (
        SELECT COUNT(DISTINCT f.user_id)::int AS qty, COALESCE(SUM(f.amount_cents),0) AS tot
        FROM (
          SELECT DISTINCT ON (t.user_id) t.user_id, t.amount_cents, t.created_at
          FROM transactions t
          JOIN users u ON u.id = t.user_id
          WHERE u.referred_by = $1 AND t.status = 'paid' AND t.type IN ('deposit','pix_in')
          ORDER BY t.user_id, t.created_at ASC
        ) f
        WHERE 1=1 ${buildClause('f', 'created_at').clause}
      ),
      qftd AS (
        SELECT COUNT(*)::int AS qty, COALESCE(SUM(f.amount_cents),0) AS tot
        FROM (
          SELECT DISTINCT ON (t.user_id) t.user_id, t.amount_cents, t.created_at
          FROM transactions t
          JOIN users u ON u.id = t.user_id
          WHERE u.referred_by = $1 AND t.status = 'paid' AND t.type IN ('deposit','pix_in') AND t.amount_cents >= 3000
          ORDER BY t.user_id, t.created_at ASC
        ) f
        WHERE 1=1 ${buildClause('f', 'created_at').clause}
      ),
      rev AS (
        SELECT COALESCE(SUM(ac.amount_cents),0) AS total,
               COALESCE(SUM(ac.amount_cents) FILTER (WHERE ac.status='paid'),0) AS paid,
               COALESCE(SUM(ac.amount_cents) FILTER (WHERE ac.status='pending'),0) AS pending
        FROM affiliate_commissions ac
        WHERE ac.affiliate_id = $2 ${acCl}
      ),
      rev_all AS (
        SELECT COALESCE(SUM(amount_cents),0) AS paid_all
        FROM affiliate_commissions WHERE affiliate_id = $2 AND status = 'paid'
      ),
      visits AS (
        SELECT COUNT(*)::int AS qty FROM affiliate_visits v
        WHERE v.affiliate_id = $2 ${buildClause('v', 'created_at').clause}
      )
      SELECT
        (SELECT qty FROM visits) AS visits,
        (SELECT COUNT(*)::int FROM leads_in_period) AS signups,
        (SELECT qty FROM ftd) AS ftd_qty, (SELECT tot FROM ftd) AS ftd_tot,
        (SELECT qty FROM qftd) AS qftd_qty, (SELECT tot FROM qftd) AS qftd_tot,
        (SELECT qty FROM dep) AS dep_qty, (SELECT tot FROM dep) AS dep_tot,
        (SELECT qty FROM wd) AS wd_qty, (SELECT tot FROM wd) AS wd_tot,
        (SELECT total FROM rev) AS rev_total, (SELECT paid FROM rev) AS rev_paid, (SELECT pending FROM rev) AS rev_pending,
        (SELECT paid_all FROM rev_all) AS rev_paid_total
    `, [uid, aff.id]);

    const row = r.rows[0];
    const modelR = await query("SELECT value FROM platform_settings WHERE key = 'aff_commission_type' LIMIT 1");
    const pctR = await query("SELECT value FROM platform_settings WHERE key = 'aff_revshare_pct' LIMIT 1");

    // Saque disponível = pendente + paid não sacado (approx: total - já sacado)
    const wdR = await query('SELECT COALESCE(SUM(amount_cents),0) AS paid_out FROM affiliate_withdrawals WHERE affiliate_id=$1 AND status IN (\'paid\',\'approved\',\'completed\')', [aff.id]);
    const paidOut = parseInt(wdR.rows[0].paid_out || 0);
    const totalPaid = parseInt(row.rev_paid_total || 0);
    const available = Math.max(0, totalPaid - paidOut);

    res.json({
      ok: true,
      code: aff.code, level: aff.level || 1,
      model: modelR.rows[0]?.value || aff.model || 'revshare',
      pct: parseFloat(pctR.rows[0]?.value || aff.commission_pct || 50),
      metrics: {
        visits: parseInt(row.visits || 0),
        signups: parseInt(row.signups || 0),
        ftd_qty: parseInt(row.ftd_qty || 0), ftd_tot: parseInt(row.ftd_tot || 0),
        qftd_qty: parseInt(row.qftd_qty || 0), qftd_tot: parseInt(row.qftd_tot || 0),
        dep_qty: parseInt(row.dep_qty || 0), dep_tot: parseInt(row.dep_tot || 0),
        wd_qty: parseInt(row.wd_qty || 0), wd_tot: parseInt(row.wd_tot || 0),
        rev_period: parseInt(row.rev_total || 0),
        rev_pending: parseInt(row.rev_pending || 0),
        rev_paid_total: parseInt(row.rev_paid_total || 0),
        available_cents: available,
        paid_out_cents: paidOut
      }
    });
  } catch (err) {
    console.error('[AFF DASHBOARD]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao carregar dashboard' });
  }
});

// GET /api/affiliate/links — list
router.get('/affiliate/links', requireUser, async (req, res) => {
  try {
    const aff = await ensureAffiliate(req.session.user.id);
    const r = await query(
      'SELECT id, name, code, clicks, signups, deposits, is_active, created_at FROM affiliate_links WHERE affiliate_id=$1 ORDER BY created_at DESC',
      [aff.id]
    );
    res.json({ ok: true, links: r.rows, default_code: aff.code });
  } catch (err) {
    console.error('[AFF LINKS GET]', err);
    res.status(500).json({ ok: false, msg: 'Erro' });
  }
});

// POST /api/affiliate/links — create
router.post('/affiliate/links', requireUser, async (req, res) => {
  try {
    const aff = await ensureAffiliate(req.session.user.id);
    const name = (req.body.name || '').toString().trim().slice(0, 128);
    if (!name) return res.status(400).json({ ok: false, msg: 'Informe um nome para a campanha' });
    let desired = (req.body.code || '').toString().trim().slice(0, 32).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!desired) desired = aff.code.toLowerCase() + '_' + Math.random().toString(36).slice(2, 6);
    // ensure unique
    let code = desired; let n = 1;
    while (true) {
      const e = await query('SELECT 1 FROM affiliate_links WHERE code=$1', [code]);
      if (!e.rows.length) break;
      n++; code = desired + '_' + n;
      if (n > 50) return res.status(400).json({ ok: false, msg: 'Não foi possível gerar código único' });
    }
    const r = await query(
      'INSERT INTO affiliate_links (affiliate_id, name, code) VALUES ($1, $2, $3) RETURNING id, name, code, clicks, signups, deposits, is_active, created_at',
      [aff.id, name, code]
    );
    res.json({ ok: true, link: r.rows[0] });
  } catch (err) {
    console.error('[AFF LINKS POST]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao criar link' });
  }
});

// DELETE /api/affiliate/links/:id
router.delete('/affiliate/links/:id', requireUser, async (req, res) => {
  try {
    const aff = await ensureAffiliate(req.session.user.id);
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, msg: 'ID inválido' });
    await query('DELETE FROM affiliate_links WHERE id=$1 AND affiliate_id=$2', [id, aff.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[AFF LINKS DELETE]', err);
    res.status(500).json({ ok: false, msg: 'Erro' });
  }
});

// GET /api/affiliate/subaffiliates?page=&per_page=
router.get('/affiliate/subaffiliates', requireUser, async (req, res) => {
  try {
    const aff = await ensureAffiliate(req.session.user.id);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(req.query.per_page) || 10, 5), 100);
    const offset = (page - 1) * perPage;
    const cnt = await query('SELECT COUNT(*)::int AS c FROM affiliates WHERE parent_id = $1', [aff.id]);
    const total = cnt.rows[0].c;
    const r = await query(`
      SELECT a.id, a.code, a.level, a.created_at, u.username, u.email,
        COALESCE((SELECT COUNT(*)::int FROM users WHERE referred_by = a.user_id), 0) AS leads,
        COALESCE((SELECT SUM(amount_cents) FROM affiliate_commissions WHERE affiliate_id = a.id), 0) AS commissions
      FROM affiliates a JOIN users u ON u.id = a.user_id
      WHERE a.parent_id = $1
      ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`, [aff.id, perPage, offset]);
    res.json({
      ok: true, subs: r.rows, invite_code: aff.code,
      pagination: { total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)) }
    });
  } catch (err) {
    console.error('[AFF SUBS]', err);
    res.status(500).json({ ok: false, msg: 'Erro' });
  }
});

// GET /api/affiliate/indicados?period=&from=&to=&page=&per_page=
router.get('/affiliate/indicados', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const aff = await ensureAffiliate(uid);
    const period = (req.query.period || 'all').toString();
    const from = (req.query.from || '').toString();
    const to = (req.query.to || '').toString();
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(req.query.per_page) || 20, 5), 100);
    const offset = (page - 1) * perPage;

    const brDate = (c) => `((${c} AT TIME ZONE 'America/Sao_Paulo')::date)`;
    const brToday = `((NOW() AT TIME ZONE 'America/Sao_Paulo')::date)`;
    let df = '';
    if (period === 'today') df = `AND ${brDate('u.created_at')} = ${brToday}`;
    else if (period === 'yesterday') df = `AND ${brDate('u.created_at')} = ${brToday} - INTERVAL '1 day'`;
    else if (period === '7d') df = "AND u.created_at >= NOW() - INTERVAL '7 days'";
    else if (period === 'month') df = `AND ${brDate('u.created_at')} >= date_trunc('month', ${brToday})`;
    else if (period === 'custom' && from && to) df = `AND ${brDate('u.created_at')} BETWEEN '${from.replace(/'/g,'')}'::date AND '${to.replace(/'/g,'')}'::date`;

    const cntR = await query(`SELECT COUNT(*)::int AS c FROM users u WHERE u.referred_by = $1 ${df}`, [uid]);
    const total = cntR.rows[0].c;

    const r = await query(`
      SELECT u.id, u.username, u.email, u.created_at,
        COALESCE((SELECT SUM(amount_cents) FROM transactions t WHERE t.user_id=u.id AND t.status='paid' AND t.type IN ('deposit','pix_in')),0) AS deposits,
        COALESCE((SELECT SUM(amount_cents) FROM withdrawals w WHERE w.user_id=u.id AND w.status IN ('paid','approved','completed')),0) AS withdrawals,
        COALESCE((SELECT SUM(amount_cents) FROM affiliate_commissions ac WHERE ac.affiliate_id=$2 AND ac.referred_user_id=u.id AND ac.type='deposit'),0) AS cpa,
        COALESCE((SELECT SUM(amount_cents) FROM affiliate_commissions ac WHERE ac.affiliate_id=$2 AND ac.referred_user_id=u.id AND ac.type='revshare'),0) AS revshare,
        COALESCE((SELECT SUM(amount_cents) FROM affiliate_commissions ac WHERE ac.affiliate_id=$2 AND ac.referred_user_id=u.id),0) AS total_commission
      FROM users u WHERE u.referred_by = $1 ${df}
      ORDER BY u.created_at DESC LIMIT $3 OFFSET $4
    `, [uid, aff.id, perPage, offset]);

    // Summary cards
    const sumR = await query(`
      SELECT
        COUNT(*)::int AS total_leads,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM transactions t WHERE t.user_id=u.id AND t.status='paid' AND t.type IN ('deposit','pix_in')))::int AS with_deposit,
        COALESCE(SUM((SELECT SUM(ac.amount_cents) FROM affiliate_commissions ac WHERE ac.affiliate_id=$2 AND ac.referred_user_id=u.id AND ac.type='deposit')),0) AS bonus_paid,
        COALESCE(SUM((SELECT SUM(ac.amount_cents) FROM affiliate_commissions ac WHERE ac.affiliate_id=$2 AND ac.referred_user_id=u.id AND ac.type='revshare')),0) AS revshare_total,
        COALESCE(SUM((SELECT SUM(ac.amount_cents) FROM affiliate_commissions ac WHERE ac.affiliate_id=$2 AND ac.referred_user_id=u.id)),0) AS total_commission
      FROM users u WHERE u.referred_by = $1 ${df}
    `, [uid, aff.id]);

    res.json({
      ok: true,
      rows: r.rows,
      pagination: { total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)) },
      summary: {
        total_leads: sumR.rows[0].total_leads,
        with_deposit: sumR.rows[0].with_deposit,
        bonus_paid_cents: parseInt(sumR.rows[0].bonus_paid || 0),
        revshare_total_cents: parseInt(sumR.rows[0].revshare_total || 0),
        total_commission_cents: parseInt(sumR.rows[0].total_commission || 0)
      }
    });
  } catch (err) {
    console.error('[AFF INDICADOS]', err);
    res.status(500).json({ ok: false, msg: 'Erro' });
  }
});

// GET /api/affiliate/withdrawals
router.get('/affiliate/withdrawals', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const aff = await ensureAffiliate(uid);
    const r = await query(
      'SELECT id, amount_cents, pix_type, pix_key, status, notes, requested_at, paid_at FROM affiliate_withdrawals WHERE affiliate_id=$1 ORDER BY requested_at DESC LIMIT 100',
      [aff.id]
    );
    res.json({ ok: true, rows: r.rows });
  } catch (err) {
    console.error('[AFF WD GET]', err);
    res.status(500).json({ ok: false, msg: 'Erro' });
  }
});

// POST /api/affiliate/withdrawals — request saque
router.post('/affiliate/withdrawals', requireUser, async (req, res) => {
  try {
    const uid = req.session.user.id;
    const aff = await ensureAffiliate(uid);
    const amount = parseInt(req.body.amount_cents || 0);
    if (!amount || amount < 5000) return res.status(400).json({ ok: false, msg: 'Valor mínimo R$ 50,00' });
    const pixType = (req.body.pix_type || '').toString().slice(0, 16);
    const pixKey = (req.body.pix_key || '').toString().slice(0, 255);
    if (!pixKey) return res.status(400).json({ ok: false, msg: 'Informe a chave PIX' });

    const balR = await query(`
      SELECT COALESCE((SELECT SUM(amount_cents) FROM affiliate_commissions WHERE affiliate_id=$1 AND status='paid'),0) -
             COALESCE((SELECT SUM(amount_cents) FROM affiliate_withdrawals WHERE affiliate_id=$1 AND status IN ('pending','approved','paid','completed')),0) AS available
    `, [aff.id]);
    const available = parseInt(balR.rows[0].available || 0);
    if (amount > available) return res.status(400).json({ ok: false, msg: 'Saldo insuficiente. Disponível: R$ ' + (available/100).toFixed(2) });

    const r = await query(
      `INSERT INTO affiliate_withdrawals (affiliate_id, user_id, amount_cents, pix_type, pix_key, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id, amount_cents, status, requested_at`,
      [aff.id, uid, amount, pixType, pixKey]
    );
    res.json({ ok: true, withdrawal: r.rows[0] });
  } catch (err) {
    console.error('[AFF WD POST]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao solicitar saque' });
  }
});

// ═════════════════════════════════════════════════════════════════════
//  CHATBOT — FAQ knowledge base + escalation to support ticket
// ═════════════════════════════════════════════════════════════════════
const CHAT_KB = {
  greeting: {
    text: 'Olá! 👋 Eu sou a Bet, sua assistente virtual na VemNaBet. Como posso ajudar?',
    options: [
      { id: 'depositar', label: '💸 Como depositar?' },
      { id: 'sacar', label: '💰 Como sacar?' },
      { id: 'bonus', label: '🎁 Bônus e Promoções' },
      { id: 'conta', label: '👤 Minha Conta' },
      { id: 'problema', label: '⚠️ Tenho um problema' },
      { id: 'responsavel', label: '🛡️ Jogo Responsável' }
    ]
  },
  depositar: {
    text: 'Para depositar é simples e rápido:\n\n1️⃣ Clique em "Depositar" no topo da tela\n2️⃣ Escolha o valor (mínimo R$ 1,00)\n3️⃣ Copie o código PIX ou escaneie o QR Code\n4️⃣ Pague pelo seu banco\n\n✅ Saldo creditado em até 2 minutos após confirmação.',
    options: [
      { id: 'dep_nao_caiu', label: '❓ Meu depósito não caiu' },
      { id: 'dep_min', label: '💵 Valor mínimo/máximo' },
      { id: 'dep_metodos', label: '💳 Métodos disponíveis' },
      { id: 'menu', label: '↩️ Voltar ao menu' }
    ]
  },
  dep_nao_caiu: {
    text: 'Se o depósito não caiu em 10 minutos:\n\n🔹 Verifique no app do seu banco se o pagamento foi concluído\n🔹 Confira se usou o código PIX correto (sem copiar espaços)\n🔹 O limite é R$ 50.000 por depósito\n\nSe já se passaram mais de 15 min e o valor não caiu, posso te conectar com um atendente humano.',
    options: [
      { id: 'escalate:deposito', label: '🧑‍💼 Falar com atendente' },
      { id: 'menu', label: '↩️ Voltar ao menu' }
    ]
  },
  dep_min: {
    text: '💵 **Limites de depósito:**\n\n• Mínimo: R$ 1,00\n• Máximo: R$ 50.000,00 por transação\n• Sem limite diário\n• Sem taxas',
    options: [{ id: 'depositar', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  dep_metodos: {
    text: '💳 **Métodos aceitos:**\n\n✅ PIX (instantâneo)\n✅ QR Code PIX\n✅ Copia e Cola\n\nNão aceitamos boleto, cartão ou transferência — apenas PIX por segurança e agilidade.',
    options: [{ id: 'depositar', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  sacar: {
    text: '💰 Para sacar seus ganhos:\n\n1️⃣ Acesse Carteira → Sacar\n2️⃣ Digite o valor (mínimo R$ 30,00)\n3️⃣ Confirme sua chave PIX cadastrada\n4️⃣ Aguarde aprovação (até 24h úteis)\n\n⚠️ Importante: Para sacar é necessário ter a conta verificada (CPF + Data de Nascimento).',
    options: [
      { id: 'saque_tempo', label: '⏱️ Tempo de saque' },
      { id: 'saque_doc', label: '📋 Documentos necessários' },
      { id: 'saque_recusa', label: '❌ Meu saque foi recusado' },
      { id: 'menu', label: '↩️ Voltar ao menu' }
    ]
  },
  saque_tempo: {
    text: '⏱️ **Tempo de processamento:**\n\n• Revisão: até 4 horas\n• Pagamento PIX: instantâneo após aprovação\n• Prazo máximo: 24h úteis\n\n💡 Saques solicitados fora do horário comercial são processados no próximo dia útil.',
    options: [{ id: 'sacar', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  saque_doc: {
    text: '📋 **Documentos para verificação:**\n\n✅ CPF\n✅ Data de nascimento\n✅ Nome completo\n✅ Chave PIX no mesmo CPF da conta\n\n⚠️ Saques com chave PIX de terceiros serão recusados.',
    options: [{ id: 'sacar', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  saque_recusa: {
    text: 'Saques podem ser recusados por:\n\n🔸 Chave PIX diferente do CPF do titular\n🔸 Dados de cadastro incompletos\n🔸 Requisitos de aposta do bônus não cumpridos\n🔸 Suspeita de fraude (analisamos caso a caso)\n\nQuer falar com um atendente para entender seu caso?',
    options: [
      { id: 'escalate:saque', label: '🧑‍💼 Falar com atendente' },
      { id: 'menu', label: '↩️ Voltar ao menu' }
    ]
  },
  bonus: {
    text: '🎁 **Nossas promoções:**\n\n💎 Bônus de 100% no 1º depósito (até R$ 500)\n💎 Cashback semanal de até 15%\n💎 Rodadas grátis toda segunda\n💎 Indique e ganhe 50% vitalício\n\nQual te interessa?',
    options: [
      { id: 'bonus_rollover', label: '📊 Como funciona o rollover' },
      { id: 'bonus_indique', label: '🤝 Indique e Ganhe' },
      { id: 'bonus_cashback', label: '💸 Cashback' },
      { id: 'menu', label: '↩️ Voltar ao menu' }
    ]
  },
  bonus_rollover: {
    text: '📊 **Rollover (apostas mínimas):**\n\n• Bônus de depósito: rollover 10x\n• Rodadas grátis: rollover 5x sobre ganhos\n• Apostas esportivas: odd mínima 1.50\n• Cassino: 100% do valor\n• Ao vivo: 50% do valor\n\n💡 Só é possível sacar após cumprir o rollover.',
    options: [{ id: 'bonus', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  bonus_indique: {
    text: '🤝 **Indique e Ganhe:**\n\nVocê recebe **50% de comissão vitalícia** sobre a movimentação dos seus indicados. Sem limite de indicações.\n\n1️⃣ Acesse sua carteira → Indique e Ganhe\n2️⃣ Copie seu link exclusivo\n3️⃣ Compartilhe nas redes sociais\n4️⃣ Saque suas comissões a qualquer momento',
    options: [{ id: 'bonus', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  bonus_cashback: {
    text: '💸 **Cashback semanal:**\n\n• 5% até R$ 1.000 perdidos\n• 10% entre R$ 1.001 e R$ 5.000\n• 15% acima de R$ 5.001\n\nCréditado toda segunda às 12h direto na sua carteira (saldo real, sem rollover).',
    options: [{ id: 'bonus', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  conta: {
    text: '👤 **Minha Conta:**\n\nO que você quer fazer?',
    options: [
      { id: 'conta_senha', label: '🔑 Esqueci minha senha' },
      { id: 'conta_verif', label: '✅ Verificação KYC' },
      { id: 'conta_dados', label: '📝 Alterar meus dados' },
      { id: 'conta_bloq', label: '🔒 Conta bloqueada' },
      { id: 'menu', label: '↩️ Voltar ao menu' }
    ]
  },
  conta_senha: {
    text: '🔑 **Recuperar senha:**\n\n1️⃣ Vá em Entrar → "Esqueci minha senha"\n2️⃣ Digite seu email\n3️⃣ Clique no link recebido\n4️⃣ Defina uma nova senha\n\n💡 Link expira em 30 minutos. Verifique também a caixa de spam.',
    options: [{ id: 'conta', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  conta_verif: {
    text: '✅ **Verificação de identidade (KYC):**\n\nObrigatória para saques. Necessário informar:\n\n• CPF\n• Data de nascimento\n• Nome completo\n• Endereço\n• Chave PIX no seu nome\n\n⏱️ Aprovação em até 24h após envio.',
    options: [{ id: 'conta', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  conta_dados: {
    text: '📝 Você pode alterar seus dados em:\n\nCarteira → Dados da Conta\n\nItens editáveis: nome, telefone, endereço, chave PIX, foto.\n\n⚠️ CPF e data de nascimento só podem ser alterados via atendente.',
    options: [
      { id: 'escalate:dados', label: '🧑‍💼 Falar com atendente' },
      { id: 'conta', label: '↩️ Voltar' }
    ]
  },
  conta_bloq: {
    text: '🔒 Sua conta pode ter sido bloqueada por:\n\n• Tentativas de login incorretas\n• Dados suspeitos no cadastro\n• Pedido de auto-exclusão\n• Violação dos Termos de Uso\n\nFale com um atendente para resolver.',
    options: [
      { id: 'escalate:bloqueio', label: '🧑‍💼 Falar com atendente' },
      { id: 'menu', label: '↩️ Voltar ao menu' }
    ]
  },
  problema: {
    text: '⚠️ Vamos resolver! Qual é o problema?',
    options: [
      { id: 'prob_jogo', label: '🎰 Jogo travou / não carrega' },
      { id: 'prob_aposta', label: '🎯 Aposta não foi creditada' },
      { id: 'prob_lento', label: '🐢 Site muito lento' },
      { id: 'escalate:outro', label: '🧑‍💼 Outro problema' },
      { id: 'menu', label: '↩️ Voltar ao menu' }
    ]
  },
  prob_jogo: {
    text: '🎰 Se um jogo travou:\n\n1️⃣ Atualize a página (F5)\n2️⃣ Limpe o cache do navegador\n3️⃣ Tente em outro navegador (Chrome/Firefox)\n4️⃣ Se o saldo foi debitado sem jogar, será reembolsado em até 24h',
    options: [
      { id: 'escalate:jogo', label: '🧑‍💼 Abrir chamado' },
      { id: 'menu', label: '🏠 Menu' }
    ]
  },
  prob_aposta: {
    text: '🎯 Aposta não creditada:\n\n• Verifique em Carteira → Histórico de Apostas\n• Apostas são processadas em até 2 min\n• Se após 10 min não aparecer, podemos investigar',
    options: [
      { id: 'escalate:aposta', label: '🧑‍💼 Abrir chamado' },
      { id: 'menu', label: '🏠 Menu' }
    ]
  },
  prob_lento: {
    text: '🐢 Para melhorar a performance:\n\n🔹 Use Wi-Fi estável ou 4G+\n🔹 Feche outras abas pesadas\n🔹 Atualize seu navegador\n🔹 Baixe nosso app (em breve)',
    options: [{ id: 'menu', label: '🏠 Menu' }]
  },
  responsavel: {
    text: '🛡️ **Jogo Responsável:**\n\nApostar deve ser diversão, não problema. Oferecemos:\n\n✅ Limites de depósito e apostas\n✅ Limite de tempo de sessão\n✅ Auto-exclusão (7/30 dias ou permanente)\n✅ Realidade check periódica\n\n📞 Central de apoio: 0800-726-9797',
    options: [
      { id: 'resp_limite', label: '⚙️ Definir limites' },
      { id: 'resp_exc', label: '🚫 Auto-exclusão' },
      { id: 'menu', label: '↩️ Voltar ao menu' }
    ]
  },
  resp_limite: {
    text: '⚙️ Configure em:\n\nCarteira → Jogo Responsável → Limites\n\nVocê pode definir limites diários, semanais ou mensais de depósito, apostas e perdas. Reduções são imediatas, aumentos têm carência de 7 dias.',
    options: [{ id: 'responsavel', label: '↩️ Voltar' }, { id: 'menu', label: '🏠 Menu' }]
  },
  resp_exc: {
    text: '🚫 Auto-exclusão:\n\n• 7 dias: pausa temporária\n• 30 dias: pausa média\n• Permanente: encerramento definitivo\n\n⚠️ Após ativada, não é possível reverter durante o período. Sua conta será bloqueada e não receberá promoções.',
    options: [
      { id: 'escalate:autoexclusao', label: '🧑‍💼 Solicitar auto-exclusão' },
      { id: 'responsavel', label: '↩️ Voltar' }
    ]
  }
};

// POST /api/chat/message — send intent, get bot response
router.post('/chat/message', async (req, res) => {
  try {
    const intent = (req.body.intent || 'greeting').toString();
    let node = CHAT_KB[intent] || CHAT_KB.greeting;
    if (intent === 'menu') node = CHAT_KB.greeting;
    res.json({ ok: true, intent, text: node.text, options: node.options || [] });
  } catch (err) {
    console.error('[CHAT MSG]', err);
    res.status(500).json({ ok: false, msg: 'Erro' });
  }
});

// POST /api/chat/escalate — create support ticket from chat
router.post('/chat/escalate', async (req, res) => {
  try {
    const topic = (req.body.topic || 'outro').toString().slice(0, 64);
    const name = (req.body.name || '').toString().slice(0, 128);
    const email = (req.body.email || '').toString().slice(0, 128);
    const message = (req.body.message || '').toString().slice(0, 2000);
    const uid = req.session.user?.id || null;

    if (!uid && (!name || !email)) {
      return res.status(400).json({ ok: false, msg: 'Informe nome e email para continuar.' });
    }
    if (!message) return res.status(400).json({ ok: false, msg: 'Descreva seu problema.' });

    const subject = 'Chatbot: ' + topic;
    const t = await query(
      `INSERT INTO support_tickets (user_id, subject, status, priority) VALUES ($1, $2, 'open', 'normal') RETURNING id`,
      [uid, subject]
    );
    const ticketId = t.rows[0].id;
    await query(
      `INSERT INTO support_messages (ticket_id, sender_type, sender_id, message) VALUES ($1, 'user', $2, $3)`,
      [ticketId, uid, `[Tópico: ${topic}] ${name ? 'Nome: ' + name + '\n' : ''}${email ? 'Email: ' + email + '\n' : ''}\n${message}`]
    );
    res.json({ ok: true, ticket_id: ticketId, msg: 'Chamado criado! Nossa equipe responde em até 4h.' });
  } catch (err) {
    console.error('[CHAT ESCALATE]', err);
    res.status(500).json({ ok: false, msg: 'Erro ao abrir chamado' });
  }
});

module.exports = router;