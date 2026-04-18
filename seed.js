// seed.js â€” Populates all 18 tables with professional sample data
// Run: railway run node seed.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool, query } = require('./src/config/database');

async function seed() {
  console.log('[SEED] Starting...');

  // â”€â”€â”€ 1. Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const karlosHash = await bcrypt.hash('123456', 10);
  const adminHash = await bcrypt.hash('Admin@12345', 10);
  const testHash = await bcrypt.hash('teste123', 10);

  await query(`
    INSERT INTO users (username, phone, email, cpf, password_hash, bonus, balance, credit_score) VALUES
    ('karlos', '11999887766', 'karlos@gmail.com', '12345678901', $1, 50.00, 250.00, 100),
    ('jogador1', '21988776655', 'jogador1@email.com', '98765432100', $2, 25.00, 180.50, 75),
    ('maria_bet', '31977665544', 'maria@hotmail.com', '11122233344', $2, 100.00, 520.00, 150),
    ('lucastop', '41966554433', 'lucas.top@gmail.com', '55566677788', $2, 10.00, 75.00, 30),
    ('ana_vip', '51955443322', 'ana.vip@outlook.com', '99988877766', $2, 200.00, 1500.00, 300),
    ('pedro_pro', '61944332211', 'pedro@email.com', '44433322211', $2, 0, 45.00, 10),
    ('rafaella', '71933221100', 'rafa@gmail.com', '77766655544', $2, 30.00, 320.00, 85),
    ('bruno_slot', '81922110099', 'bruno.slots@email.com', '22211100099', $2, 15.00, 90.00, 40),
    ('teste', '11911111111', 'teste@teste.com', '00000000000', $2, 0, 0, 0),
    ('vip_player', '11922222222', 'vip@casino.com', '11111111111', $2, 500.00, 5000.00, 500)
    ON CONFLICT (username) DO NOTHING
  `, [karlosHash, testHash]);
  console.log('[SEED] Users âœ“');

  // â”€â”€â”€ 2. Admin Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await query(`UPDATE admin_users SET password_hash = $1 WHERE username = 'admin' AND password_hash LIKE '%placeholder%'`, [adminHash]);
  await query(`
    INSERT INTO admin_users (username, password_hash, role) VALUES
    ('moderador', $1, 'moderator'),
    ('suporte', $1, 'support')
    ON CONFLICT (username) DO NOTHING
  `, [adminHash]);
  console.log('[SEED] Admins âœ“');

  // â”€â”€â”€ 3. Wallets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const usersR = await query('SELECT id, balance FROM users');
  for (const u of usersR.rows) {
    await query(`
      INSERT INTO wallets (user_id, balance_cents) VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET balance_cents = $2
    `, [u.id, Math.round(parseFloat(u.balance) * 100)]);
  }
  console.log('[SEED] Wallets âœ“');

  // â”€â”€â”€ 4. Games â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const games = [
    ['fortune-tiger', 'Fortune Tiger', '/public/img/games/1.avif', 'pg', 'quente', 1],
    ['fortune-ox', 'Fortune Ox', '/public/img/games/2.webp', 'pg', 'quente', 2],
    ['fortune-rabbit', 'Fortune Rabbit', '/public/img/games/3.webp', 'pg', 'pg', 3],
    ['fortune-mouse', 'Fortune Mouse', '/public/img/games/4.webp', 'pg', 'pg', 4],
    ['dragon-hatch', 'Dragon Hatch', '/public/img/games/5.webp', 'pg', 'pg', 5],
    ['ganesha-gold', 'Ganesha Gold', '/public/img/games/6.webp', 'pg', 'quente', 6],
    ['double-fortune', 'Double Fortune', '/public/img/games/7.webp', 'pg', 'pg', 7],
    ['lucky-neko', 'Lucky Neko', '/public/img/games/8.webp', 'pg', 'pg', 8],
    ['wild-bandito', 'Wild Bandito', '/public/img/games/9.webp', 'pg', 'quente', 9],
    ['mahjong-ways', 'Mahjong Ways', '/public/img/games/10.avif', 'pg', 'pg', 10],
    ['aztec-gems', 'Aztec Gems', '/public/img/games/11.webp', 'pp', 'pp', 11],
    ['gates-of-olympus', 'Gates of Olympus', '/public/img/games/12.webp', 'pp', 'quente', 12],
    ['mines-pro', 'Mines Pro', '/public/img/games/5.webp', 'wg', 'mines', 13],
    ['crash-x', 'Crash X', '/public/img/games/3.webp', 'wg', 'crash', 14],
    ['dice-master', 'Dice Master', '/public/img/games/7.webp', 'wg', 'dice', 15],
    ['super-ace', 'Super Ace', '/public/img/games/4.webp', 'jili', 'jili', 16],
    ['boxing-king', 'Boxing King', '/public/img/games/8.webp', 'jili', 'jili', 17],
    ['money-coming', 'Money Coming', '/public/img/games/6.webp', 'jili', 'jili', 18],
    ['golden-empire', 'Golden Empire', '/public/img/games/9.webp', 'jili', 'quente', 19],
    ['treasure-hunt', 'Treasure Hunt', '/public/img/games/2.webp', 'cq9', 'cq9', 20],
    ['jump-high', 'Jump High', '/public/img/games/11.webp', 'cq9', 'cq9', 21],
    ['hot-fruits', 'Hot Fruits', '/public/img/games/1.avif', 'evor', 'evor', 22],
    ['spaceman', 'Spaceman', '/public/img/games/10.avif', 'pp', 'crash', 23],
    ['sweet-bonanza', 'Sweet Bonanza', '/public/img/games/12.webp', 'pp', 'pp', 24],
    // â”€â”€ Novos jogos â”€â”€
    ['big-bass-bonanza', 'Big Bass Bonanza', '/public/img/games/3.webp', 'pp', 'pp', 25],
    ['sugar-rush', 'Sugar Rush', '/public/img/games/6.webp', 'pp', 'quente', 26],
    ['starlight-princess', 'Starlight Princess', '/public/img/games/8.webp', 'pp', 'pp', 27],
    ['wolf-gold', 'Wolf Gold', '/public/img/games/11.webp', 'pp', 'pp', 28],
    ['book-of-dead', 'Book of Dead', '/public/img/games/9.webp', 'playngo', 'playngo', 29],
    ['reactoonz', 'Reactoonz', '/public/img/games/4.webp', 'playngo', 'playngo', 30],
    ['fire-joker', 'Fire Joker', '/public/img/games/7.webp', 'playngo', 'playngo', 31],
    ['starburst', 'Starburst', '/public/img/games/2.webp', 'netent', 'netent', 32],
    ['gonzo-quest', 'Gonzo Quest', '/public/img/games/5.webp', 'netent', 'netent', 33],
    ['dead-or-alive', 'Dead or Alive 2', '/public/img/games/10.avif', 'netent', 'netent', 34],
    ['crazy-time', 'Crazy Time', '/public/img/games/1.avif', 'evolution', 'live', 35],
    ['lightning-roulette', 'Lightning Roulette', '/public/img/games/12.webp', 'evolution', 'live', 36],
    ['monopoly-live', 'Monopoly Live', '/public/img/games/4.webp', 'evolution', 'live', 37],
    ['cash-or-crash', 'Cash or Crash', '/public/img/games/8.webp', 'evolution', 'crash', 38],
    ['aviator', 'Aviator', '/public/img/games/3.webp', 'spribe', 'crash', 39],
    ['plinko', 'Plinko', '/public/img/games/6.webp', 'spribe', 'spribe', 40],
    ['penalty-shootout', 'Penalty Shootout', '/public/img/games/11.webp', 'spribe', 'spribe', 41],
    ['book-of-shadows', 'Book of Shadows', '/public/img/games/9.webp', 'nolimit', 'nolimit', 42],
    ['mental', 'Mental', '/public/img/games/7.webp', 'nolimit', 'nolimit', 43],
    ['tombstone-rip', 'Tombstone RIP', '/public/img/games/5.webp', 'nolimit', 'nolimit', 44],
    ['wanted-dead', 'Wanted Dead or a Wild', '/public/img/games/2.webp', 'hacksaw', 'hacksaw', 45],
    ['chaos-crew', 'Chaos Crew', '/public/img/games/10.avif', 'hacksaw', 'hacksaw', 46],
    ['stack-em', 'Stack Em', '/public/img/games/1.avif', 'hacksaw', 'hacksaw', 47],
    ['fruit-party', 'Fruit Party', '/public/img/games/12.webp', 'pp', 'pp', 48],
    ['dog-house', 'The Dog House Megaways', '/public/img/games/4.webp', 'pp', 'quente', 49],
    ['buffalo-king', 'Buffalo King Megaways', '/public/img/games/8.webp', 'pp', 'pp', 50],
    // â”€â”€ Batch 3 â€” mais jogos â”€â”€
    ['fortune-pirates', 'Fortune Pirates', '/public/img/games/1.avif', 'pg', 'pg', 51],
    ['fortune-fruits', 'Fortune Fruits', '/public/img/games/2.webp', 'pg', 'pg', 52],
    ['midas-fortune', 'Midas Fortune', '/public/img/games/5.webp', 'pg', 'quente', 53],
    ['fortune-dragon', 'Fortune Dragon', '/public/img/games/7.webp', 'pg', 'pg', 54],
    ['master-chens-fortune', 'Master Chens Fortune', '/public/img/games/9.webp', 'pg', 'pg', 55],
    ['fortune-of-giza', 'Fortune of Giza', '/public/img/games/11.webp', 'pg', 'pg', 56],
    ['fairytale-fortune', 'Fairytale Fortune', '/public/img/games/3.webp', 'pp', 'pp', 57],
    ['octobeer-fortunes', 'Octobeer Fortunes', '/public/img/games/6.webp', 'pp', 'pp', 58],
    ['fortune-gems-2', 'Fortune Gems 2', '/public/img/games/10.avif', 'pp', 'quente', 59],
    ['pandas-fortune-2', 'Pandas Fortune 2', '/public/img/games/4.webp', 'pp', 'pp', 60],
    ['fortune-gems-3', 'Fortune Gems 3', '/public/img/games/8.webp', 'pp', 'pp', 61],
    ['fortune-gems', 'Fortune Gems', '/public/img/games/12.webp', 'pp', 'pp', 62],
    ['fortune-tree', 'Fortune Tree', '/public/img/games/2.webp', 'pp', 'pp', 63],
    ['drago-jewels', 'Drago Jewels of Fortune', '/public/img/games/5.webp', 'pp', 'quente', 64],
    ['three-star-fortune', 'Three Star Fortune', '/public/img/games/9.webp', 'pp', 'pp', 65],
    ['pandas-fortune', 'Pandas Fortune', '/public/img/games/7.webp', 'pp', 'pp', 66],
    ['fortune-pig', 'Fortune Pig', '/public/img/games/1.avif', 'pg', 'pg', 67],
    ['fortune-monkey', 'Fortune Monkey', '/public/img/games/3.webp', 'pg', 'pg', 68],
    ['papai-noel-fortune', 'Papai Noel da Fortuna', '/public/img/games/11.webp', 'pg', 'pg', 69],
    ['golden-wealth-baccarat', 'Golden Wealth Baccarat', '/public/img/games/6.webp', 'evolution', 'live', 70],
    ['mega-ball', 'Mega Ball', '/public/img/games/10.avif', 'evolution', 'live', 71],
    ['dream-catcher', 'Dream Catcher', '/public/img/games/4.webp', 'evolution', 'live', 72],
    ['football-studio', 'Football Studio', '/public/img/games/8.webp', 'evolution', 'live', 73],
    ['speed-baccarat', 'Speed Baccarat', '/public/img/games/12.webp', 'evolution', 'live', 74],
    ['mines-deluxe', 'Mines Deluxe', '/public/img/games/2.webp', 'wg', 'mines', 75],
    ['hilo', 'HiLo', '/public/img/games/9.webp', 'spribe', 'spribe', 76],
    ['mini-roulette', 'Mini Roulette', '/public/img/games/5.webp', 'spribe', 'spribe', 77],
    ['hotline-2', 'Hotline 2', '/public/img/games/7.webp', 'netent', 'netent', 78],
    ['twin-spin', 'Twin Spin', '/public/img/games/3.webp', 'netent', 'netent', 79],
    ['rise-of-olympus', 'Rise of Olympus', '/public/img/games/11.webp', 'playngo', 'playngo', 80],
    ['legacy-of-dead', 'Legacy of Dead', '/public/img/games/1.avif', 'playngo', 'playngo', 81],
    ['san-quentin', 'San Quentin', '/public/img/games/6.webp', 'nolimit', 'nolimit', 82],
    ['fire-in-the-hole', 'Fire in the Hole', '/public/img/games/10.avif', 'nolimit', 'nolimit', 83]
  ];
  for (const [code, name, img, provider, category, sort] of games) {
    await query(`
      INSERT INTO games (game_code, game_name, image_url, provider, category, sort_order) 
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (game_code) DO UPDATE SET game_name=$2, image_url=$3, provider=$4, category=$5, sort_order=$6
    `, [code, name, img, provider, category, sort]);
  }
  console.log('[SEED] Games âœ“ (' + games.length + ')');

  // â”€â”€â”€ 4b. Fix theme colors (green/purple â†’ orange) â”€â”€
  await query(`
    UPDATE themes SET css_vars = jsonb_set(jsonb_set(jsonb_set(jsonb_set(css_vars::jsonb, 
      '{green1}', '"#34D399"'), '{green2}', '"#25D366"'), '{green3}', '"#1A9E4C"'), '{accent}', '"#25D366"')
    WHERE css_vars::text LIKE '%10B981%' OR css_vars::text LIKE '%10b981%' 
       OR css_vars::text LIKE '%c084fc%' OR css_vars::text LIKE '%6EE7B7%' 
       OR css_vars::text LIKE '%6ee7b7%' OR css_vars::text LIKE '%7c3aed%'
  `);
  console.log('[SEED] Theme colors fixed â†’ orange âœ“');

  // â”€â”€â”€ 5. Banners â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const banners = [
    ['/public/img/banner1.avif', null, 1],
    ['/public/img/banner2.webp', null, 2],
    ['/public/img/banner3.webp', null, 3],
    ['/public/img/banner4.avif', null, 4],
    ['/public/img/banner5.webp', null, 5],
    ['/public/img/banner6.avif', null, 6],
    ['/public/img/banner7.avif', null, 7],
    ['/public/img/banner8.avif', null, 8],
    ['/public/img/banner9.webp', null, 9],
    ['/public/img/banner10.webp', null, 10]
  ];
  // Clear existing banners first
  await query('DELETE FROM banners');
  for (const [img, link, sort] of banners) {
    await query('INSERT INTO banners (image_url, link_url, sort_order) VALUES ($1, $2, $3)', [img, link, sort]);
  }
  console.log('[SEED] Banners âœ“ (' + banners.length + ')');

  // â”€â”€â”€ 6. Transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const userIds = usersR.rows.map(u => u.id);
  const txData = [];
  // Deposits paid
  for (let i = 0; i < 25; i++) {
    const uid = userIds[i % userIds.length];
    const amt = [3000, 5000, 10000, 15000, 20000, 25000, 50000, 100000][Math.floor(Math.random() * 8)];
    const daysAgo = Math.floor(Math.random() * 30);
    txData.push({ uid, type: 'deposit', status: 'paid', amt, days: daysAgo });
  }
  // Deposits pending
  for (let i = 0; i < 5; i++) {
    const uid = userIds[i % userIds.length];
    const amt = [3000, 5000, 10000][Math.floor(Math.random() * 3)];
    txData.push({ uid, type: 'deposit', status: 'pending', amt, days: 0 });
  }
  // Deposits failed
  for (let i = 0; i < 3; i++) {
    const uid = userIds[(i + 3) % userIds.length];
    txData.push({ uid, type: 'deposit', status: 'failed', amt: 5000, days: Math.floor(Math.random() * 10) });
  }
  // Withdrawals
  for (let i = 0; i < 8; i++) {
    const uid = userIds[i % userIds.length];
    const amt = [5000, 10000, 20000, 50000][Math.floor(Math.random() * 4)];
    const status = ['completed', 'pending', 'completed', 'completed'][Math.floor(Math.random() * 4)];
    txData.push({ uid, type: 'withdrawal', status, amt, days: Math.floor(Math.random() * 15) });
  }
  // Bonus transactions
  for (let i = 0; i < 6; i++) {
    const uid = userIds[i % userIds.length];
    txData.push({ uid, type: 'bonus', status: 'paid', amt: [1000, 2500, 5000, 10000][Math.floor(Math.random() * 4)], days: Math.floor(Math.random() * 20) });
  }

  for (const tx of txData) {
    await query(`
      INSERT INTO transactions (user_id, type, status, amount_cents, provider, provider_ref, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'blackcat', $5, NOW() - ($6 || ' days')::INTERVAL, NOW() - ($6 || ' days')::INTERVAL)
    `, [tx.uid, tx.type, tx.status, tx.amt, 'TX-' + Math.random().toString(36).substring(2, 10).toUpperCase(), tx.days]);
  }
  console.log('[SEED] Transactions âœ“ (' + txData.length + ')');

  // â”€â”€â”€ 7. Bets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const gamesR = await query('SELECT id FROM games LIMIT 12');
  const gameIds = gamesR.rows.map(g => g.id);
  const betsData = [];
  for (let i = 0; i < 60; i++) {
    const uid = userIds[Math.floor(Math.random() * userIds.length)];
    const gid = gameIds[Math.floor(Math.random() * gameIds.length)];
    const amt = [100, 200, 500, 1000, 2000, 5000][Math.floor(Math.random() * 6)];
    const won = Math.random() > 0.55;
    const multiplier = won ? (Math.random() * 15 + 1.1).toFixed(2) : 0;
    const payout = won ? Math.round(amt * multiplier) : 0;
    const status = won ? 'won' : 'lost';
    const days = Math.floor(Math.random() * 14);
    betsData.push({ uid, gid, amt, payout, multiplier, status, days });
  }
  for (const b of betsData) {
    await query(`
      INSERT INTO bets (user_id, game_id, amount_cents, payout_cents, multiplier, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() - ($7 || ' days')::INTERVAL)
    `, [b.uid, b.gid, b.amt, b.payout, b.multiplier, b.status, b.days]);
  }
  console.log('[SEED] Bets âœ“ (' + betsData.length + ')');

  // â”€â”€â”€ 8. Game Rounds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  for (let i = 0; i < 30; i++) {
    const gid = gameIds[Math.floor(Math.random() * gameIds.length)];
    const hash = require('crypto').randomBytes(32).toString('hex');
    const seed2 = require('crypto').randomBytes(16).toString('hex');
    const status = ['open', 'closed', 'closed', 'closed'][Math.floor(Math.random() * 4)];
    const result = { multiplier: (Math.random() * 20 + 1).toFixed(2), symbol: ['ðŸ¯', 'ðŸ‰', 'ðŸ’Ž', 'ðŸ€', 'ðŸŽ°'][Math.floor(Math.random() * 5)] };
    const hoursAgo = Math.floor(Math.random() * 168);
    const endedAt = status === 'closed' ? new Date(Date.now() - hoursAgo * 3600000 + 120000) : null;
    const startedAt = new Date(Date.now() - hoursAgo * 3600000);
    await query(`
      INSERT INTO game_rounds (game_id, round_hash, seed, result, status, started_at, ended_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [gid, hash, seed2, JSON.stringify(result), status, startedAt, endedAt]);
  }
  console.log('[SEED] Game Rounds âœ“');

  // â”€â”€â”€ 9. Affiliates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const affiliateUserIds = userIds.slice(0, 5);
  for (let i = 0; i < affiliateUserIds.length; i++) {
    const code = ['KARLOS10', 'JOGADOR5', 'MARIA20', 'LUCASVIP', 'ANAPRO'][i];
    const pct = [10, 5, 20, 8, 15][i];
    const earned = Math.floor(Math.random() * 50000);
    await query(`
      INSERT INTO affiliates (user_id, code, commission_pct, total_earned_cents, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT (user_id) DO NOTHING
    `, [affiliateUserIds[i], code, pct, earned]);
  }
  console.log('[SEED] Affiliates âœ“');

  // â”€â”€â”€ 10. Affiliate Commissions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const affR = await query('SELECT id, user_id FROM affiliates');
  for (const aff of affR.rows) {
    for (let j = 0; j < 3; j++) {
      const referredId = userIds.filter(id => id !== aff.user_id)[Math.floor(Math.random() * (userIds.length - 1))];
      const amt = Math.floor(Math.random() * 5000) + 100;
      const status = ['paid', 'paid', 'pending'][Math.floor(Math.random() * 3)];
      await query(`
        INSERT INTO affiliate_commissions (affiliate_id, referred_user_id, amount_cents, status, created_at)
        VALUES ($1, $2, $3, $4, NOW() - ($5 || ' days')::INTERVAL)
      `, [aff.id, referredId, amt, status, Math.floor(Math.random() * 30)]);
    }
  }
  console.log('[SEED] Affiliate Commissions âœ“');

  // â”€â”€â”€ 11. Support Tickets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tickets = [
    { uid: userIds[0], subject: 'DepÃ³sito nÃ£o creditado', priority: 'high', status: 'open' },
    { uid: userIds[1], subject: 'Como funciona o bÃ´nus de boas-vindas?', priority: 'normal', status: 'closed' },
    { uid: userIds[2], subject: 'Preciso alterar meu telefone', priority: 'normal', status: 'in_progress' },
    { uid: userIds[3], subject: 'Saque pendente hÃ¡ 2 dias', priority: 'urgent', status: 'open' },
    { uid: userIds[4], subject: 'Bug no jogo Fortune Tiger', priority: 'high', status: 'in_progress' },
    { uid: userIds[0], subject: 'Quero ser afiliado VIP', priority: 'low', status: 'closed' },
    { uid: userIds[5], subject: 'Conta bloqueada sem motivo', priority: 'urgent', status: 'open' },
    { uid: userIds[2], subject: 'PromoÃ§Ã£o nÃ£o aparece na minha conta', priority: 'normal', status: 'open' }
  ];
  for (const t of tickets) {
    const r = await query(`
      INSERT INTO support_tickets (user_id, subject, status, priority, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW() - ($5 || ' days')::INTERVAL, NOW() - ($6 || ' hours')::INTERVAL)
      RETURNING id
    `, [t.uid, t.subject, t.status, t.priority, Math.floor(Math.random() * 15) + 1, Math.floor(Math.random() * 48)]);
    const ticketId = r.rows[0].id;

    // Add messages
    await query(`
      INSERT INTO support_messages (ticket_id, sender_type, sender_id, message, created_at) VALUES
      ($1, 'user', $2, $3, NOW() - INTERVAL '2 days')
    `, [ticketId, t.uid, 'OlÃ¡, ' + t.subject.toLowerCase() + '. Podem me ajudar?']);

    if (t.status !== 'open') {
      const admR = await query('SELECT id FROM admin_users LIMIT 1');
      await query(`
        INSERT INTO support_messages (ticket_id, sender_type, sender_id, message, created_at) VALUES
        ($1, 'admin', $2, $3, NOW() - INTERVAL '1 day')
      `, [ticketId, admR.rows[0].id, 'OlÃ¡! Estamos analisando seu caso. Em breve retornaremos com uma soluÃ§Ã£o.']);
    }
  }
  console.log('[SEED] Support Tickets + Messages âœ“');

  // â”€â”€â”€ 12. Promotions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const promos = [
    { title: 'BÃ´nus de Boas-Vindas 100%', desc: 'Duplique seu primeiro depÃ³sito! Deposite e receba 100% de bÃ´nus.', type: 'bonus', cents: 0, pct: 100, minDep: 3000, maxUses: 0, code: 'WELCOME100', active: true, expires: 90 },
    { title: 'Cashback Semanal 15%', desc: 'Receba 15% de volta das suas perdas da semana.', type: 'cashback', cents: 0, pct: 15, minDep: 5000, maxUses: 0, code: 'CASHBACK15', active: true, expires: 30 },
    { title: 'R$25 GrÃ¡tis no Cadastro', desc: 'Receba R$25 sÃ³ por se cadastrar! Sem depÃ³sito necessÃ¡rio.', type: 'bonus', cents: 2500, pct: 0, minDep: 0, maxUses: 500, code: 'FREE25', active: true, expires: 60 },
    { title: 'Freebet R$50 - Fortune Tiger', desc: 'Aposta grÃ¡tis de R$50 no Fortune Tiger!', type: 'freebet', cents: 5000, pct: 0, minDep: 10000, maxUses: 100, code: 'TIGER50', active: true, expires: 15 },
    { title: 'BÃ´nus VIP 200%', desc: 'Exclusivo para jogadores VIP. Deposite e ganhe 200%!', type: 'bonus', cents: 0, pct: 200, minDep: 50000, maxUses: 50, code: 'VIP200', active: true, expires: 45 },
    { title: 'Happy Hour - Sexta-feira', desc: 'Todas as sextas: depÃ³sitos com 50% extra das 18h Ã s 23h.', type: 'bonus', cents: 0, pct: 50, minDep: 3000, maxUses: 0, code: 'FRIDAY50', active: false, expires: 7 },
    { title: 'Indique e Ganhe R$10', desc: 'Ganhe R$10 para cada amigo que depositar.', type: 'bonus', cents: 1000, pct: 0, minDep: 0, maxUses: 0, code: 'INDICA10', active: true, expires: 365 }
  ];
  for (const p of promos) {
    await query(`
      INSERT INTO promotions (title, description, type, value_cents, value_pct, min_deposit, max_uses, code, is_active, starts_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW() + ($10 || ' days')::INTERVAL)
      ON CONFLICT (code) DO NOTHING
    `, [p.title, p.desc, p.type, p.cents, p.pct, p.minDep, p.maxUses, p.code, p.active, p.expires]);
  }
  console.log('[SEED] Promotions âœ“');

  // â”€â”€â”€ 13. User Promotions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const promosR = await query('SELECT id FROM promotions LIMIT 4');
  const promoIds = promosR.rows.map(p => p.id);
  for (let i = 0; i < 15; i++) {
    const uid = userIds[Math.floor(Math.random() * userIds.length)];
    const pid = promoIds[Math.floor(Math.random() * promoIds.length)];
    const status = ['claimed', 'used', 'expired'][Math.floor(Math.random() * 3)];
    const amt = Math.floor(Math.random() * 10000) + 500;
    await query(`
      INSERT INTO user_promotions (user_id, promotion_id, status, amount_cents, created_at)
      VALUES ($1, $2, $3, $4, NOW() - ($5 || ' days')::INTERVAL)
    `, [uid, pid, status, amt, Math.floor(Math.random() * 30)]);
  }
  console.log('[SEED] User Promotions âœ“');

  // â”€â”€â”€ 14. Admin Audit Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const adminsR = await query('SELECT id, username FROM admin_users');
  const auditActions = [
    { action: 'user.toggle_active', target_type: 'user', tid: userIds[5] },
    { action: 'game.create', target_type: 'game', tid: gameIds[0] },
    { action: 'theme.activate', target_type: 'theme', tid: 1 },
    { action: 'settings.update', target_type: 'setting', tid: null },
    { action: 'deposit.approve', target_type: 'transaction', tid: 1 },
    { action: 'user.toggle_active', target_type: 'user', tid: userIds[2] },
    { action: 'banner.create', target_type: 'banner', tid: 1 },
    { action: 'promotion.create', target_type: 'promotion', tid: promoIds[0] },
    { action: 'ticket.reply', target_type: 'support_ticket', tid: 1 },
    { action: 'ticket.close', target_type: 'support_ticket', tid: 2 },
    { action: 'game.delete', target_type: 'game', tid: 99 },
    { action: 'admin.login', target_type: 'admin', tid: adminsR.rows[0]?.id }
  ];
  for (const a of auditActions) {
    const adminId = adminsR.rows[Math.floor(Math.random() * adminsR.rows.length)]?.id;
    await query(`
      INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() - ($7 || ' hours')::INTERVAL)
    `, [adminId, a.action, a.target_type, a.tid, JSON.stringify({ note: 'AÃ§Ã£o executada com sucesso' }), '177.38.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255), Math.floor(Math.random() * 200)]);
  }
  console.log('[SEED] Audit Log âœ“');

  // â”€â”€â”€ 15. Platform Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const settings = [
    ['min_deposit', '3000'],
    ['max_deposit', '5000000'],
    ['min_withdrawal', '5000'],
    ['max_withdrawal', '10000000'],
    ['pix_fee_pct', '0'],
    ['telegram_url', 'https://t.me/cassino_suporte'],
    ['support_email', 'suporte@cassino.com'],
    ['welcome_bonus_pct', '100'],
    ['referral_bonus_cents', '1000'],
    ['max_daily_withdrawals', '3']
  ];
  for (const [k, v] of settings) {
    await query('INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [k, v]);
  }
  console.log('[SEED] Platform Settings âœ“');

  // â”€â”€â”€ Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const counts = await query(`
    SELECT 
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM wallets) AS wallets,
      (SELECT COUNT(*) FROM admin_users) AS admins,
      (SELECT COUNT(*) FROM transactions) AS transactions,
      (SELECT COUNT(*) FROM games) AS games,
      (SELECT COUNT(*) FROM banners) AS banners,
      (SELECT COUNT(*) FROM bets) AS bets,
      (SELECT COUNT(*) FROM game_rounds) AS game_rounds,
      (SELECT COUNT(*) FROM affiliates) AS affiliates,
      (SELECT COUNT(*) FROM affiliate_commissions) AS aff_commissions,
      (SELECT COUNT(*) FROM support_tickets) AS tickets,
      (SELECT COUNT(*) FROM support_messages) AS messages,
      (SELECT COUNT(*) FROM promotions) AS promotions,
      (SELECT COUNT(*) FROM user_promotions) AS user_promos,
      (SELECT COUNT(*) FROM admin_audit_log) AS audit_logs,
      (SELECT COUNT(*) FROM platform_settings) AS settings,
      (SELECT COUNT(*) FROM themes) AS themes,
      (SELECT COUNT(*) FROM sessions) AS sessions
  `);
  
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('  SEED COMPLETO â€” Contagem final:');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  const c = counts.rows[0];
  Object.entries(c).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v}`));
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

  await pool.end();
}

seed().catch(err => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
