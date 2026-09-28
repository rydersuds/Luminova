const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fenix-test-'));
process.env.DATA_DIR = dataDir;
process.env.ADMIN_PASSWORD = 'secret';
const { server } = require('../server');

let base;
const auth = { Authorization: 'Basic ' + Buffer.from('admin:secret').toString('base64') };

before(async () => {
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const get = (p, headers) => fetch(base + p, { headers });
const post = (p, body, headers = {}) => fetch(base + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

// A Wednesday a few days out (open 09:00–20:00).
function nextWeekday(dow) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const date = nextWeekday(3);
const slots = async (duration = 60) => (await (await get(`/api/availability?service=therapeutic&duration=${duration}&date=${date}`)).json()).slots;
const client = { name: 'Test Client', phone: '403 555 0100', email: 'test@example.com' };

test('config lists services and hours', async () => {
  const res = await get('/api/config');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.services.length >= 10);
  assert.match(body.today, /^\d{4}-\d{2}-\d{2}$/);
});

test('availability covers opening hours', async () => {
  const s = await slots();
  assert.equal(s[0], '09:00');
  assert.equal(s.at(-1), '19:00');
});

test('availability rejects unknown service or bad duration', async () => {
  assert.equal((await get(`/api/availability?service=nope&duration=60&date=${date}`)).status, 400);
  assert.equal((await get(`/api/availability?service=therapeutic&duration=50&date=${date}`)).status, 400);
});

test('booking a slot removes it and its buffer; double-booking is refused', async () => {
  const res = await post('/api/bookings', { service: 'therapeutic', duration: 60, date, time: '10:00', ...client });
  assert.equal(res.status, 201);
  const b = await res.json();
  assert.match(b.ref, /^[A-Z2-9]{6}$/);

  const s = await slots();
  assert.ok(!s.includes('10:00'));
  assert.ok(!s.includes('09:00'), '09:00–10:00 has no 15 min buffer before 10:00');
  assert.ok(!s.includes('11:00'), '11:00 starts within the buffer after 11:00');
  assert.ok(s.includes('11:30'));

  const again = await post('/api/bookings', { service: 'deep-tissue', duration: 90, date, time: '10:00', ...client });
  assert.equal(again.status, 409);
});

test('bookings are priced from the price list, with the new-client discount', async () => {
  let res = await post('/api/bookings', { service: 'deep-tissue', duration: 45, date, time: '13:00', ...client });
  let b = await res.json();
  assert.equal(res.status, 201);
  assert.equal(b.price, 80);
  assert.equal(b.total, 80);

  res = await post('/api/bookings', { service: 'stone', duration: 90, date, time: '15:00', firstVisit: true, ...client });
  b = await res.json();
  assert.equal(res.status, 201);
  assert.equal(b.price, 200);
  assert.equal(b.total, 180);

  // Hot & cold stone has no 30 min option.
  res = await post('/api/bookings', { service: 'stone', duration: 30, date, time: '17:30', ...client });
  assert.equal(res.status, 400);

  // Tidy up so later tests see an open afternoon.
  const { bookings } = await (await get(`/api/admin/bookings?from=${date}&to=${date}`, auth)).json();
  for (const x of bookings.filter((x) => ['13:00', '15:00'].includes(x.time))) {
    assert.ok(x.price && x.total);
    await post(`/api/admin/bookings/${x.id}/cancel`, {}, auth);
  }
});

test('invalid details are rejected with field errors', async () => {
  const res = await post('/api/bookings', { service: 'therapeutic', duration: 60, date, time: '14:00', name: '', phone: '1', email: 'nope' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.fields.name && body.fields.phone && body.fields.email);
});

test('past dates and closed times offer nothing', async () => {
  const past = await (await get('/api/availability?service=therapeutic&duration=60&date=2020-01-01')).json();
  assert.deepEqual(past.slots, []);
  const res = await post('/api/bookings', { service: 'therapeutic', duration: 60, date, time: '19:30', ...client });
  assert.equal(res.status, 409, 'a 60 min session at 19:30 runs past closing');
});

test('admin endpoints require the password', async () => {
  assert.equal((await get('/api/admin/bookings')).status, 401);
  assert.equal((await get('/admin')).status, 401);
  const wrong = { Authorization: 'Basic ' + Buffer.from('admin:nope').toString('base64') };
  assert.equal((await get('/api/admin/bookings', wrong)).status, 401);
  assert.equal((await get('/admin', auth)).status, 200);
});

test('admin can cancel a booking, freeing the slot', async () => {
  const { bookings } = await (await get(`/api/admin/bookings?from=${date}&to=${date}`, auth)).json();
  const b = bookings.find((x) => x.time === '10:00' && x.status === 'confirmed');
  assert.ok(b);
  assert.equal((await post(`/api/admin/bookings/${b.id}/cancel`, {}, auth)).status, 200);
  assert.ok((await slots()).includes('10:00'));
});

test('admin blocks remove availability and can be deleted', async () => {
  const res = await post('/api/admin/blocks', { date, start: '15:00', end: '17:00', reason: 'Break' }, auth);
  assert.equal(res.status, 201);
  const { id } = await res.json();
  let s = await slots();
  assert.ok(!s.includes('15:00') && !s.includes('16:00') && !s.includes('14:30'));
  assert.ok(s.includes('14:00'));
  await fetch(`${base}/api/admin/blocks/${id}`, { method: 'DELETE', headers: auth });
  s = await slots();
  assert.ok(s.includes('15:00'));
});

test('static files are served and traversal is blocked', async () => {
  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/booking.js')).status, 200);
  assert.equal((await get('/..%2fserver.js')).status, 404);
  assert.equal((await get('/%2e%2e/config.js')).status, 404);
});
