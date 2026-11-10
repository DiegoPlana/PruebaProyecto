import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

// Static routes must work even when PostgreSQL is unavailable. No query is made.
process.env.DATABASE_URL ||= 'postgres://unused:unused@127.0.0.1:1/unused';
const {server} = await import('../src/server.mjs');
const {pool} = await import('../src/db.mjs');
let base;
before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
});
const routes = ['/', '/albergue', '/habitaciones', '/restaurante', '/servicios', '/galeria', '/contacto', '/reservas'];

test('public pages and shared layout are generated from the current templates', () => {
  execFileSync(process.execPath, ['scripts/build-pages.mjs', '--check']);
});

test('all eight routes return independent documents, active navigation and complete links', async () => {
  const titles = new Set();
  const mainContents = new Set();
  let footer;
  for (const path of routes) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
    const html = await response.text();
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${path}: one primary heading`);
    titles.add(html.match(/<title>(.*?)<\/title>/s)[1]);
    mainContents.add(html.match(/<main\b[^>]*>(.*?)<\/main>/s)[1]);
    const navigation = html.match(/<nav id="navigation"[^>]*>(.*?)<\/nav>/s)[1];
    const links = [...navigation.matchAll(/<a href="([^"]+)"([^>]*)>/g)];
    assert.deepEqual(links.map(link => link[1]), routes);
    assert.deepEqual(links.filter(link => link[2].includes('aria-current="page"')).map(link => link[1]), [path]);
    assert.equal(links.some(link => link[1].includes('#')), false);
    const thisFooter = html.match(/<footer\b.*?<\/footer>/s)[0].replaceAll(' aria-current="page"', '');
    if (footer) assert.equal(thisFooter, footer);
    footer = thisFooter;
  }
  assert.equal(titles.size, routes.length);
  assert.equal(mainContents.size, routes.length);
});

test('direct loads, query strings, trailing slashes, HEAD and reloads all resolve', async () => {
  for (const path of routes) {
    for (const suffix of ['', '?origen=prueba', ...(path==='/'?[]:['/'])]) {
      const response = await fetch(base + path + suffix);
      assert.equal(response.status, 200, path + suffix);
      const html = await response.text();
      assert.match(html, /<main id="main"/);
    }
    const response = await fetch(base + path, {method:'HEAD'});
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '');
  }
});

test('functional content is limited to its page and forms retain their contracts', async () => {
  for (const path of routes) {
    const html = await (await fetch(base + path)).text();
    assert.equal(html.includes('id="room-cards"'), path==='/habitaciones', `${path}: inventory`);
    assert.equal(html.includes('id="search-form"'), path==='/reservas', `${path}: lodging search`);
    assert.equal(html.includes('id="calendar"'), path==='/reservas', `${path}: calendar`);
    assert.equal(html.includes('id="restaurant-search"'), path==='/restaurante', `${path}: restaurant search`);
    assert.equal(html.includes('id="request-dialog"'), ['/reservas','/restaurante'].includes(path));
    assert.equal(html.includes('src="/app.js"'), ['/habitaciones','/reservas','/restaurante'].includes(path));
    if (['/reservas','/restaurante'].includes(path)) {
      for (const field of ['firstName','lastName','email','phone']) assert.match(html, new RegExp(`name="${field}"[^>]*required`));
    }
  }
});

test('public navigation assets and existing admin/legal pages remain accessible', async () => {
  for (const path of ['/navigation.js','/pages.css','/style.css','/app.js','/shared.js','/mark.svg','/landscape.svg','/admin','/admin.html','/admin.js','/legal.html']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
  }
});

test('unknown pages and APIs return 404 instead of the homepage', async () => {
  for (const path of ['/not-a-page','/reservas/not-a-page','/constructor','/api/not-a-route','/frontend/layout.html']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get('content-type'), /^application\/json/);
  }
});
