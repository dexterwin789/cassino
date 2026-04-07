const router = require('express').Router();
const { query } = require('../config/database');

// Main page
router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');

    res.render('index', {
      title: 'Cassino',
      games: gamesR.rows,
      banners: bannersR.rows
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
    let sql = 'SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE';
    const params = [];
    if (provider) {
      params.push(provider);
      sql += ' AND LOWER(provider) = LOWER($' + params.length + ')';
    }
    if (category) {
      params.push(category);
      sql += ' AND LOWER(category) = LOWER($' + params.length + ')';
    }
    sql += ' ORDER BY sort_order, id DESC';
    const gamesR = await query(sql, params);
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const providersR = await query('SELECT DISTINCT provider FROM games WHERE is_active = TRUE AND provider IS NOT NULL ORDER BY provider');
    const categoriesR = await query('SELECT DISTINCT category FROM games WHERE is_active = TRUE AND category IS NOT NULL ORDER BY category');

    let filterLabel = 'Todos os Jogos';
    if (provider) filterLabel = 'Jogos da ' + provider.toUpperCase();
    else if (category) filterLabel = 'Jogos de ' + category;

    res.render('games', {
      title: filterLabel + ' — CassinoBet',
      games: gamesR.rows,
      banners: bannersR.rows,
      providers: providersR.rows.map(r => r.provider),
      categories: categoriesR.rows.map(r => r.category),
      filterLabel: filterLabel,
      currentProvider: provider,
      currentCategory: category
    });
  } catch (err) {
    console.error('[GAMES]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  res.render('ranking', { title: 'Ranking' });
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

    // All providers for the studios slider
    const providersR = await query('SELECT DISTINCT provider FROM games WHERE is_active = TRUE AND provider IS NOT NULL ORDER BY provider');

    // Random stats
    const rtp = (92 + Math.random() * 6).toFixed(2);
    const players24h = Math.floor(800 + Math.random() * 4200);
    const ganhos24h = (5000 + Math.random() * 45000).toFixed(2);

    res.render('game', {
      title: game.game_name + ' — CassinoBet',
      game,
      relatedGames: relatedR.rows,
      providers: providersR.rows.map(r => r.provider),
      stats: { rtp, players24h, ganhos24h }
    });
  } catch (err) {
    console.error('[GAME]', err);
    res.status(500).send('Erro');
  }
});

module.exports = router;
