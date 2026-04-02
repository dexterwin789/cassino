const router = require('express').Router();
const { query } = require('../config/database');

// Main page
router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const themeR = await query("SELECT t.* FROM themes t JOIN platform_settings ps ON ps.value = t.slug WHERE ps.key = 'active_theme' LIMIT 1");

    res.render('index', {
      title: 'Cassino',
      games: gamesR.rows,
      banners: bannersR.rows,
      theme: themeR.rows[0] || null
    });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  res.render('ranking', { title: 'Ranking' });
});

module.exports = router;
