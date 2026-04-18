const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title
```


## License: MIT
https://github.com/mariafrc/todo-list-express/blob/bd6843f3db890400c1765cf08ab0748ee5931bf3/src/views/layout/boilerplate.ejs

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title
```


## License: MIT
https://github.com/mariafrc/todo-list-express/blob/bd6843f3db890400c1765cf08ab0748ee5931bf3/src/views/layout/boilerplate.ejs

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title
```


## License: MIT
https://github.com/mariafrc/todo-list-express/blob/bd6843f3db890400c1765cf08ab0748ee5931bf3/src/views/layout/boilerplate.ejs

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title
```


## License: MIT
https://github.com/mariafrc/todo-list-express/blob/bd6843f3db890400c1765cf08ab0748ee5931bf3/src/views/layout/boilerplate.ejs

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title
```


## License: MIT
https://github.com/mariafrc/todo-list-express/blob/bd6843f3db890400c1765cf08ab0748ee5931bf3/src/views/layout/boilerplate.ejs

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title
```


## License: MIT
https://github.com/mariafrc/todo-list-express/blob/bd6843f3db890400c1765cf08ab0748ee5931bf3/src/views/layout/boilerplate.ejs

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title
```


## License: MIT
https://github.com/mariafrc/todo-list-express/blob/bd6843f3db890400c1765cf08ab0748ee5931bf3/src/views/layout/boilerplate.ejs

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title
```


## License: unknown
https://github.com/juliajjoseph/Julia-Joseph-352/blob/8ae8df0cbf387b609c62db1a113b3bb0fbcae5ca/climate-crisis-story/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/lmfl1984/GameShop/blob/22c3578da3acb3138d6c6258dbba34774b9c56ae/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/juliajjoseph/Julia-Joseph-352/blob/8ae8df0cbf387b609c62db1a113b3bb0fbcae5ca/climate-crisis-story/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/lmfl1984/GameShop/blob/22c3578da3acb3138d6c6258dbba34774b9c56ae/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/DarioDa86/htmlcss-discord/blob/e82dae249ec78f5804a6be38b136bd46f03cc6be/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/themes/vemnabet/css/style.css">
```


## License: unknown
https://github.com/juliajjoseph/Julia-Joseph-352/blob/8ae8df0cbf387b609c62db1a113b3bb0fbcae5ca/climate-crisis-story/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/lmfl1984/GameShop/blob/22c3578da3acb3138d6c6258dbba34774b9c56ae/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/DarioDa86/htmlcss-discord/blob/e82dae249ec78f5804a6be38b136bd46f03cc6be/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/themes/vemnabet/css/style.css">
```


## License: unknown
https://github.com/juliajjoseph/Julia-Joseph-352/blob/8ae8df0cbf387b609c62db1a113b3bb0fbcae5ca/climate-crisis-story/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/lmfl1984/GameShop/blob/22c3578da3acb3138d6c6258dbba34774b9c56ae/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/DarioDa86/htmlcss-discord/blob/e82dae249ec78f5804a6be38b136bd46f03cc6be/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/themes/vemnabet/css/style.css">
```


## License: unknown
https://github.com/juliajjoseph/Julia-Joseph-352/blob/8ae8df0cbf387b609c62db1a113b3bb0fbcae5ca/climate-crisis-story/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/lmfl1984/GameShop/blob/22c3578da3acb3138d6c6258dbba34774b9c56ae/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/DarioDa86/htmlcss-discord/blob/e82dae249ec78f5804a6be38b136bd46f03cc6be/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/themes/vemnabet/css/style.css">
```


## License: unknown
https://github.com/juliajjoseph/Julia-Joseph-352/blob/8ae8df0cbf387b609c62db1a113b3bb0fbcae5ca/climate-crisis-story/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/lmfl1984/GameShop/blob/22c3578da3acb3138d6c6258dbba34774b9c56ae/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/DarioDa86/htmlcss-discord/blob/e82dae249ec78f5804a6be38b136bd46f03cc6be/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/themes/vemnabet/css/style.css">
```


## License: unknown
https://github.com/juliajjoseph/Julia-Joseph-352/blob/8ae8df0cbf387b609c62db1a113b3bb0fbcae5ca/climate-crisis-story/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/lmfl1984/GameShop/blob/22c3578da3acb3138d6c6258dbba34774b9c56ae/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="
```


## License: unknown
https://github.com/DarioDa86/htmlcss-discord/blob/e82dae249ec78f5804a6be38b136bd46f03cc6be/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/themes/vemnabet/css/style.css">
```


## License: unknown
https://github.com/juliajjoseph/Julia-Joseph-352/blob/8ae8df0cbf387b609c62db1a113b3bb0fbcae5ca/climate-crisis-story/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/themes/vemnabet/css/style.css">
```


## License: unknown
https://github.com/DarioDa86/htmlcss-discord/blob/e82dae249ec78f5804a6be38b136bd46f03cc6be/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/themes/vemnabet/css/style.css">
```


## License: unknown
https://github.com/lmfl1984/GameShop/blob/22c3578da3acb3138d6c6258dbba34774b9c56ae/index.html

```


Cole este código inteiro no arquivo e salve como `c:\xampp\htdocs\cassino\setup-theme.js`:

```javascript
const fs = require('fs');
const p = require('path');
const B = 'c:/xampp/htdocs/cassino';

function w(f, c) {
  fs.mkdirSync(p.dirname(f), { recursive: true });
  fs.writeFileSync(f, c, 'utf8');
  console.log('  +', f.replace(B + '/', ''));
}
function cp(s, d) { w(d, fs.readFileSync(s, 'utf8')); }

console.log('\n=== 1. COPIANDO TEMA CLASSIC ===');
cp(B+'/views/index.ejs', B+'/views/themes/classic/index.ejs');
cp(B+'/views/ranking.ejs', B+'/views/themes/classic/ranking.ejs');
cp(B+'/views/partials/head.ejs', B+'/views/themes/classic/partials/head.ejs');
cp(B+'/views/partials/foot.ejs', B+'/views/themes/classic/partials/foot.ejs');
cp(B+'/public/css/style.css', B+'/public/themes/classic/css/style.css');
cp(B+'/public/js/script.js', B+'/public/themes/classic/js/script.js');

console.log('\n=== 2. EDITANDO SERVER.JS ===');
let srv = fs.readFileSync(B+'/server.js', 'utf8');
if (!srv.includes("'/themes'")) {
  srv = srv.replace(
    "app.use('/public', express.static(path.join(__dirname, 'public')));",
    "app.use('/themes', express.static(path.join(__dirname, 'public', 'themes')));\napp.use('/public', express.static(path.join(__dirname, 'public')));"
  );
  console.log('  + rota /themes adicionada');
}
if (!srv.includes('themeFolder')) {
  srv = srv.replace(
    'res.locals.theme = theme;',
    "res.locals.theme = theme;\n    res.locals.themeFolder = theme?.template_folder || 'classic';"
  );
  srv = srv.replace(
    'res.locals.theme = null;',
    "res.locals.theme = null;\n    res.locals.themeFolder = 'classic';"
  );
  console.log('  + themeFolder adicionado');
}
fs.writeFileSync(B+'/server.js', srv);

console.log('\n=== 3. REESCREVENDO PAGES.JS ===');
w(B+'/src/routes/pages.js', `const router = require('express').Router();
const { query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const gamesR = await query('SELECT id, game_code, game_name, image_url, provider, category FROM games WHERE is_active = TRUE ORDER BY sort_order, id DESC');
    const bannersR = await query('SELECT id, image_url, link_url FROM banners WHERE is_active = TRUE ORDER BY sort_order, id');
    const tf = res.locals.themeFolder || 'classic';
    res.render('themes/' + tf + '/index', { title: 'Cassino', games: gamesR.rows, banners: bannersR.rows });
  } catch (err) {
    console.error('[INDEX]', err);
    res.status(500).send('Erro');
  }
});

router.get('/ranking', (req, res) => {
  const tf = res.locals.themeFolder || 'classic';
  res.render('themes/' + tf + '/ranking', { title: 'Ranking' });
});

module.exports = router;
`);

console.log('\n=== 4. EDITANDO SCHEMA.SQL ===');
let sql = fs.readFileSync(B+'/src/config/schema.sql', 'utf8');
if (!sql.includes('template_folder')) {
  sql = sql.replace(
    'is_active   BOOLEAN NOT NULL DEFAULT FALSE,',
    "template_folder VARCHAR(50) DEFAULT 'classic',\n  is_active   BOOLEAN NOT NULL DEFAULT FALSE,"
  );
  sql += "\nALTER TABLE themes ADD COLUMN IF NOT EXISTS template_folder VARCHAR(50) DEFAULT 'classic';\n";
  sql += "INSERT INTO themes (slug, name, css_vars, layout_config, template_folder, is_active) VALUES ('vemnabet', 'VemNaBet', '{}', '{}', 'vemnabet', true) ON CONFLICT (slug) DO UPDATE SET template_folder = 'vemnabet';\n";
  sql += "INSERT INTO platform_settings (key, value) VALUES ('active_theme', 'vemnabet') ON CONFLICT (key) DO UPDATE SET value = 'vemnabet';\n";
  fs.writeFileSync(B+'/src/config/schema.sql', sql);
  console.log('  + template_folder + seed vemnabet');
}

console.log('\n=== 5. CRIANDO TEMA VEMNABET - HEAD.EJS ===');
w(B+'/views/themes/vemnabet/partials/head.ejs', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Cassino' %></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/themes/vemnabet/css/style.css">
```

