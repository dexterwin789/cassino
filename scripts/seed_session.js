// Cria sessão direta no DB + cookie assinado, simulando um user logado
// Usa session ID sintético. Server valida cookie via HMAC-SHA256 do secret.
const { Client } = require('pg');
const crypto = require('crypto');
const https = require('https');

const URL_DB = 'postgresql://postgres:CMxeFqOjCBbFjpBxtWMZrrUuBsjndwXI@roundhouse.proxy.rlwy.net:57858/railway';
// Railway cassino2-app env → SESSION_SECRET: do .env? Let me read it from Railway.
// For now hardcode the fallback from server.js. User said .env has dev-secret-cassino-2026
// On Railway may be different — run `railway variables --service cassino2-app` to check.

// express-session signs sid like: s:<sid>.<hmac>
function signSid(sid, secret) {
  const mac = crypto.createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
  return 's:' + sid + '.' + mac;
}

async function main() {
  const secret = process.argv[2];
  const userId = parseInt(process.argv[3] || '24', 10);
  if (!secret) {
    console.error('Uso: node seed_session.js <SESSION_SECRET> <userId>');
    process.exit(1);
  }
  const db = new Client({ connectionString: URL_DB, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const u = await db.query('SELECT id, username, name, phone, email, cpf FROM users WHERE id=$1', [userId]);
  if (!u.rows[0]) { console.error('user não existe'); process.exit(1); }

  const sid = crypto.randomBytes(16).toString('hex');
  const sessData = {
    cookie: {
      originalMaxAge: 30 * 24 * 60 * 60 * 1000,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      httpOnly: true, path: '/', secure: true, sameSite: 'none', domain: '.vemnabet.bet'
    },
    user: u.rows[0]
  };
  const expire = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.query('INSERT INTO sessions (sid, sess, expire) VALUES ($1,$2,$3)', [sid, sessData, expire]);
  const signed = signSid(sid, secret);
  const cookie = 'connect.sid=' + encodeURIComponent(signed);
  console.log('COOKIE:', cookie);

  // Testa endpoints
  const endpoints = [
    '/api/user/bets?period=total&kind=casino',
    '/api/user/bets?period=total&kind=sport',
    '/api/user/statement?period=total',
    '/api/referrals/leads?period=all'
  ];
  for (const p of endpoints) {
    const res = await new Promise((resolve, reject) => {
      const r = https.request({ hostname: 'vemnabet.bet', path: p, method: 'GET', headers: { Cookie: cookie, Accept: 'application/json' } }, (res) => {
        let buf = ''; res.on('data', c => buf += c); res.on('end', () => resolve({ status: res.statusCode, body: buf }));
      });
      r.on('error', reject); r.end();
    });
    let j; try { j = JSON.parse(res.body); } catch { j = { raw: res.body.slice(0, 100) }; }
    const n = j.rows?.length ?? j.leads?.length ?? '?';
    console.log(`  ${p}  status=${res.status}  ok=${j.ok}  rows=${n}`);
    if (n && n > 0) console.log('    sample:', JSON.stringify((j.rows || j.leads)[0]).slice(0, 180));
  }

  await db.end();
}
main().catch(e => { console.error(e); process.exit(1); });
