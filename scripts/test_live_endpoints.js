// Testa login real + todos os endpoints da carteira em produção.
// Dois usuários: karlos_araujo (id=24) e testseed (id=27).
// Rodar: node scripts/test_live_endpoints.js
const https = require('https');
const { URL } = require('url');

const BASE = 'https://vemnabet.bet';

function req(method, path, { cookies = '', body = null, csrf = '' } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method, hostname: u.hostname, path: u.pathname + u.search,
      headers: {
        'User-Agent': 'seed-test/1.0',
        'Accept': 'application/json, text/html',
        'Content-Type': 'application/json',
      }
    };
    if (cookies) opts.headers['Cookie'] = cookies;
    if (csrf) opts.headers['X-CSRF-Token'] = csrf;
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function extractCookies(headers, prev = '') {
  const set = headers['set-cookie'] || [];
  const map = {};
  // preserva cookies anteriores
  if (prev) prev.split(';').map(s => s.trim()).forEach(kv => { const [k, ...rest] = kv.split('='); if (k) map[k] = rest.join('='); });
  set.forEach(c => {
    const first = c.split(';')[0];
    const [k, ...rest] = first.split('=');
    map[k.trim()] = rest.join('=');
  });
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function loginAs(username, password) {
  console.log(`\n━━━ LOGIN ${username} ━━━`);
  // 1) GET / para pegar CSRF + cookie de sessão
  const r1 = await req('GET', '/');
  let cookies = extractCookies(r1.headers);
  const csrfMatch = r1.body.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/)
                 || r1.body.match(/content=["']([^"']+)["']\s+name=["']csrf-token["']/)
                 || r1.body.match(/csrfToken\s*[:=]\s*["']([^"']+)["']/)
                 || r1.body.match(/name=["']csrf-token["']\s+content=["']([^"']+)["']/);
  const csrf = csrfMatch ? csrfMatch[1] : '';
  console.log('  csrf:', csrf ? csrf.slice(0, 16) + '…' : 'nao encontrado');

  // 2) POST /api/login
  const r2 = await req('POST', '/api/login', {
    cookies, csrf,
    body: { login: username, password: password }
  });
  cookies = extractCookies(r2.headers, cookies);
  console.log('  login status:', r2.status, 'body:', r2.body.slice(0, 160));
  return { cookies, csrf };
}

async function testEndpoints(label, cookies) {
  console.log(`\n━━━ TEST ${label} ━━━`);
  const endpoints = [
    '/api/user/bets?period=total&kind=casino',
    '/api/user/bets?period=total&kind=sport',
    '/api/user/statement?period=total',
    '/api/referrals/leads?period=all',
  ];
  for (const p of endpoints) {
    const r = await req('GET', p, { cookies });
    let parsed;
    try { parsed = JSON.parse(r.body); } catch { parsed = { raw: r.body.slice(0, 120) }; }
    const count = parsed.rows?.length ?? parsed.leads?.length ?? '?';
    console.log(`  ${p}`);
    console.log(`    status=${r.status}  ok=${parsed.ok}  rows=${count}`);
    if (count && count !== '?' && count > 0) {
      const sample = (parsed.rows || parsed.leads)[0];
      console.log(`    sample:`, JSON.stringify(sample).slice(0, 200));
    }
  }
}

(async () => {
  const s1 = await loginAs('karlos_araujo', 'Karlos@123');
  await testEndpoints('karlos_araujo', s1.cookies);

  const s2 = await loginAs('testseed', 'teste123');
  await testEndpoints('testseed', s2.cookies);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
