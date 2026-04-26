const router = require('express').Router();
const { query } = require('../config/database');
const { categoryCondition, categoryLabel } = require('../utils/gameCategories');

// Main page
router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category, is_featured, featured_order FROM games WHERE is_active = TRUE ORDER BY is_featured DESC NULLS LAST, featured_order ASC NULLS LAST, sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const provImgR = await query('SELECT provider_name, image_url FROM provider_images WHERE is_active = TRUE ORDER BY sort_order, id');

    // Affiliate settings for homepage wallet panel
    const setR = await query(
      `SELECT key, value FROM platform_settings WHERE key IN ('aff_referral_bonus','aff_default_commission','aff_min_deposit','aff_revshare_enabled','aff_revshare_pct','bonus_enabled')`
    );
    const s = {};
    setR.rows.forEach(r => { s[r.key] = r.value; });
    const affiliateSettings = {
      referralBonusCents: parseInt(s.aff_referral_bonus || '5000', 10),
      minDepositCents: parseInt(s.aff_min_deposit || '2000', 10),
      commissionPct: parseFloat(s.aff_default_commission || '10'),
      revshareEnabled: s.aff_revshare_enabled === '1',
      revsharePct: parseFloat(s.aff_revshare_pct || '0')
    };
    const bonusEnabled = s.bonus_enabled === '1';

    res.render('index', {
      title: 'Cassino',
      games: gamesR.rows,
      banners: bannersR.rows,
      providerImages: provImgR.rows,
      affiliateSettings,
      bonusEnabled
    });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

// Games archive page
router.get('/games', async (req, res) => {
  try {
    const provider = req.query.provider || '';
    const category = req.query.category || '';
    const search = (req.query.search || req.query.q || '').toString().trim();
    let sql = 'SELECT id, game_code, game_name, image_url, provider, category, is_featured, featured_order FROM games WHERE is_active = TRUE';
    const params = [];
    if (provider) {
      params.push(provider);
      sql += ' AND LOWER(provider) = LOWER($' + params.length + ')';
    }
    if (category) {
      sql += categoryCondition(category, params);
    }
    if (search) {
      params.push('%' + search + '%');
      sql += ' AND (game_name ILIKE $' + params.length + ' OR game_code ILIKE $' + params.length + ' OR provider ILIKE $' + params.length + ' OR category ILIKE $' + params.length + ')';
    }
    sql += ' ORDER BY is_featured DESC NULLS LAST, featured_order ASC NULLS LAST, sort_order, id DESC';
    const gamesR = await query(sql, params);
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const providersR = await query('SELECT DISTINCT provider FROM games WHERE is_active = TRUE AND provider IS NOT NULL ORDER BY provider');
    const categoriesR = await query('SELECT DISTINCT category FROM games WHERE is_active = TRUE AND category IS NOT NULL ORDER BY category');

    let filterLabel = 'Todos os Jogos';
    if (provider) filterLabel = 'Jogos da ' + provider.toUpperCase();
    else if (category) filterLabel = categoryLabel(category);
    if (search) filterLabel = filterLabel + ' - ' + search;
    const categorySet = new Set(['slots', 'live']);
    categoriesR.rows.forEach(r => { if (r.category) categorySet.add(r.category); });

    res.render('games', {
      title: filterLabel + ' — VemNaBet',
      games: gamesR.rows,
      banners: bannersR.rows,
      providers: providersR.rows.map(r => r.provider),
      categories: Array.from(categorySet),
      filterLabel: filterLabel,
      currentProvider: provider,
      currentCategory: category,
      currentSearch: search
    });
  } catch (err) {
    console.error('[GAMES]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  res.render('ranking', { title: 'Ranking' });
});

// Providers page — only shows providers from provider_images (admin-controlled)
router.get('/providers', async (req, res) => {
  try {
    // Game counts for badge
    const providersR = await query(
      'SELECT provider, COUNT(*) AS count FROM games WHERE is_active = TRUE AND provider IS NOT NULL AND provider != \'\' GROUP BY provider ORDER BY provider'
    );
    const gameCounts = {};
    providersR.rows.forEach(r => { gameCounts[r.provider] = parseInt(r.count); });

    // Only show providers managed in admin (provider_images, active only)
    const provImgR = await query('SELECT provider_name, image_url FROM provider_images WHERE is_active = TRUE ORDER BY sort_order, id');
    const providers = provImgR.rows.map(r => r.provider_name);
    const providerImageMap = {};
    provImgR.rows.forEach(r => { providerImageMap[r.provider_name.toUpperCase()] = r.image_url; });

    res.render('providers', {
      title: 'Provedores — VemNaBet',
      providers,
      gameCounts,
      providerImageMap
    });
  } catch (err) {
    console.error('[PROVIDERS]', err);
    res.status(500).send('Erro');
  }
});

// Game single page
router.get('/game/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const gameR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE game_code = $1 AND is_active = TRUE', [code]);
    if (!gameR.rows.length) return res.status(404).send('Jogo não encontrado');
    const game = gameR.rows[0];

    // Related games (same provider, exclude current)
    const relatedR = await query(
      'SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE provider = $1 AND game_code != $2 AND is_active = TRUE ORDER BY sort_order, id DESC LIMIT 12',
      [game.provider, code]
    );

    // Provider images for the studios slider (from admin-managed table)
    const provImgR = await query('SELECT provider_name, image_url FROM provider_images WHERE is_active = TRUE ORDER BY sort_order, id');

    // Random stats
    const rtp = (92 + Math.random() * 6).toFixed(2);
    const players24h = Math.floor(800 + Math.random() * 4200);
    const ganhos24h = (5000 + Math.random() * 45000).toFixed(2);

    res.render('game', {
      title: game.game_name + ' — VemNaBet',
      game,
      relatedGames: relatedR.rows,
      providerImages: provImgR.rows,
      stats: { rtp, players24h, ganhos24h }
    });
  } catch (err) {
    console.error('[GAME]', err);
    res.status(500).send('Erro');
  }
});

module.exports = router;
