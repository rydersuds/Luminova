'use strict';
// Massage Fenix booking server: serves the site, the booking API and the admin dashboard.
// No dependencies; needs Node 22.13+ (built-in node:sqlite, no flag).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const NOTIFY_WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || '';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- Database ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'bookings.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY,
    ref TEXT NOT NULL UNIQUE,
    service_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    duration INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_min INTEGER NOT NULL,
    end_min INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS bookings_date ON bookings (date, status);
  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    start_min INTEGER NOT NULL,
    end_min INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS blocks_date ON blocks (date);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);
// Columns added after the first release; add them to existing databases.
const bookingCols = db.prepare('PRAGMA table_info(bookings)').all().map((c) => c.name);
if (!bookingCols.includes('price')) db.exec('ALTER TABLE bookings ADD COLUMN price REAL');
if (!bookingCols.includes('total')) db.exec('ALTER TABLE bookings ADD COLUMN total REAL');
if (!bookingCols.includes('first_visit')) db.exec('ALTER TABLE bookings ADD COLUMN first_visit INTEGER NOT NULL DEFAULT 0');

const q = {
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
  deleteSetting: db.prepare('DELETE FROM settings WHERE key = ?'),
  bookingsOn: db.prepare(`SELECT start_min, end_min FROM bookings WHERE date = ? AND status = 'confirmed'`),
  blocksOn: db.prepare(`SELECT start_min, end_min FROM blocks WHERE date = ?`),
  insertBooking: db.prepare(`INSERT INTO bookings (ref, service_id, service_name, duration, date, start_min, end_min, name, phone, email, notes, price, total, first_visit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  listBookings: db.prepare(`SELECT * FROM bookings WHERE date BETWEEN ? AND ? ORDER BY date, start_min`),
  cancelBooking: db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'confirmed'`),
  listBlocks: db.prepare(`SELECT * FROM blocks WHERE date >= ? ORDER BY date, start_min`),
  insertBlock: db.prepare(`INSERT INTO blocks (date, start_min, end_min, reason) VALUES (?, ?, ?, ?)`),
  deleteBlock: db.prepare(`DELETE FROM blocks WHERE id = ?`),
};

// ---------- Time helpers (all in studio local time) ----------
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fmtMin = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dayOfWeek = (dateStr) => new Date(dateStr + 'T12:00:00Z').getUTCDay();

function nowLocal() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) };
}

// ---------- Availability ----------
function findService(id) { return config.services.find((s) => s.id === id); }

// ---------- Availability settings ----------
// Weekly hours and booking rules. config.js holds the defaults; the admin page can save
// overrides to the database, which take effect immediately without a restart.
const AVAILABILITY_KEYS = ['hours', 'slotStepMinutes', 'bufferMinutes', 'minNoticeMinutes', 'maxDaysAhead'];
const SLOT_STEPS = [15, 20, 30, 60];
function defaultAvailability() {
  return Object.fromEntries(AVAILABILITY_KEYS.map((k) => [k, structuredClone(config[k])]));
}
function getAvailability() {
  const row = q.getSetting.get('availability');
  if (!row) return defaultAvailability();
  try { return { ...defaultAvailability(), ...JSON.parse(row.value) }; } catch { return defaultAvailability(); }
}
function validateAvailability(b) {
  const errors = [];
  const out = {};
  if (!b || typeof b !== 'object' || !b.hours || typeof b.hours !== 'object') return { errors: ['Weekly hours are missing.'] };
  out.hours = {};
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let d = 0; d < 7; d++) {
    const h = b.hours[d] ?? b.hours[String(d)];
    if (h === null || h === undefined || h === false) { out.hours[d] = null; continue; }
    if (!Array.isArray(h) || h.length !== 2 || !TIME_RE.test(h[0]) || !TIME_RE.test(h[1])) { errors.push(`${DAYS[d]}: enter an opening and closing time.`); continue; }
    if (toMin(h[1]) - toMin(h[0]) < 30) { errors.push(`${DAYS[d]}: closing must be at least 30 minutes after opening.`); continue; }
    out.hours[d] = [h[0], h[1]];
  }
  if (Object.values(out.hours).every((h) => h === null) && !errors.length) errors.push('Open at least one day a week.');
  const int = (key, min, max, label) => {
    const v = Number(b[key]);
    if (!Number.isInteger(v) || v < min || v > max) errors.push(`${label} must be between ${min} and ${max}.`);
    else out[key] = v;
  };
  if (!SLOT_STEPS.includes(Number(b.slotStepMinutes))) errors.push('Start times must be every 15, 20, 30 or 60 minutes.');
  else out.slotStepMinutes = Number(b.slotStepMinutes);
  int('bufferMinutes', 0, 120, 'Break between appointments (minutes)');
  int('minNoticeMinutes', 0, 7 * 24 * 60, 'Minimum notice (minutes)');
  int('maxDaysAhead', 1, 365, 'Booking window (days)');
  return { errors, value: out };
}

function availableSlots(date, duration) {
  if (!isValidDate(date)) return [];
  const a = getAvailability();
  const now = nowLocal();
  if (date < now.date || date > addDays(now.date, a.maxDaysAhead)) return [];
  const hours = a.hours[dayOfWeek(date)];
  if (!hours) return [];
  const open = toMin(hours[0]);
  const close = toMin(hours[1]);
  const buf = a.bufferMinutes;
  const busy = [
    ...q.bookingsOn.all(date).map((b) => [b.start_min - buf, b.end_min + buf]),
    ...q.blocksOn.all(date).map((b) => [b.start_min, b.end_min]),
  ];
  const earliest = date === now.date ? now.min + a.minNoticeMinutes : -1;
  const slots = [];
  for (let t = open; t + duration <= close; t += a.slotStepMinutes) {
    if (t < earliest) continue;
    if (busy.some(([s, e]) => t < e && t + duration > s)) continue;
    slots.push(fmtMin(t));
  }
  return slots;
}

// ---------- HTTP helpers ----------
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function readJson(req, limit = 10 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return req.headers['x-forwarded-for'].split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

// Simple in-memory rate limit for booking submissions.
const hits = new Map();
function rateLimited(ip, max = 8, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (list.every((t) => now - t > 60 * 60 * 1000)) hits.delete(ip);
}, 10 * 60 * 1000).unref();

// ---------- Admin sign-in ----------
// Staff sign in on /admin/login and get a signed session cookie. Scripts can still send the
// password with HTTP Basic auth. Sessions are signed with a key derived from ADMIN_PASSWORD,
// so changing the password signs everyone out.
const SESSION_COOKIE = 'fenix_admin';
const SESSION_HOURS = 12;
const sessionKey = () => crypto.createHash('sha256').update('fenix-session:' + ADMIN_PASSWORD).digest();
const sign = (data) => crypto.createHmac('sha256', sessionKey()).update(data).digest('base64url');
function passwordMatches(pass) {
  const a = crypto.createHash('sha256').update(String(pass)).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}
function newSession() {
  const exp = String(Date.now() + SESSION_HOURS * 3600 * 1000);
  return `${exp}.${sign(exp)}`;
}
function validSession(token) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((kv) => kv[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
function isHttps(req) {
  return process.env.COOKIE_SECURE === '1' || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https');
}
function sessionCookie(req, value, maxAge) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  if (validSession(cookies(req)[SESSION_COOKIE])) return true;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const [, pass = ''] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(/:(.*)/s);
  return passwordMatches(pass);
}
function requireAdmin(req, res, { page = false } = {}) {
  if (!ADMIN_PASSWORD) { send(res, 503, 'Admin is disabled. Set the ADMIN_PASSWORD environment variable.'); return false; }
  if (isAdmin(req)) return true;
  if (page) send(res, 303, '', { Location: '/admin/login' });
  else send(res, 401, { error: 'Please sign in again.' });
  return false;
}
const loginFailures = new Map();
function redirect(res, location, headers = {}) { send(res, 303, '', { Location: location, ...headers }); }

function readForm(req, limit = 4 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); } });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(body))));
    req.on('error', reject);
  });
}

function serveLogin(res, message) {
  fs.readFile(path.join(__dirname, 'admin', 'login.html'), 'utf8', (err, html) => {
    if (err) return send(res, 500, 'Login page missing');
    const note = message ? `<p class="login-msg" role="alert">${message}</p>` : '';
    send(res, 200, html.replace('<!--MESSAGE-->', note), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
};
function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, data, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  });
}

// ---------- Booking validation ----------
function validateBooking(b) {
  const errors = {};
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const service = findService(str(b.service));
  const duration = Number(b.duration);
  const date = str(b.date);
  const time = str(b.time);
  const name = str(b.name);
  const phone = str(b.phone);
  const email = str(b.email);
  const notes = str(b.notes);

  if (!service) errors.service = 'Choose a service.';
  else if (!service.durations.includes(duration)) errors.duration = 'Choose a session length.';
  if (!isValidDate(date)) errors.date = 'Choose a date.';
  if (!TIME_RE.test(time)) errors.time = 'Choose a time.';
  if (!name || name.length > 100) errors.name = 'Enter your name.';
  if (phone.replace(/\D/g, '').length < 7 || phone.length > 30) errors.phone = 'Enter a valid phone number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) errors.email = 'Enter a valid email address.';
  if (notes.length > 1000) errors.notes = 'Notes must be under 1000 characters.';

  const firstVisit = b.firstVisit === true;
  return { errors, value: { service, duration, date, time, name, phone, email, notes, firstVisit } };
}

// Price for a service and length, with the new-client discount applied to the total.
function quote(service, duration, firstVisit) {
  const price = service.prices[duration];
  const pct = firstVisit ? config.newClientDiscountPercent : 0;
  return { price, total: Math.round(price * (100 - pct)) / 100, discountPercent: pct };
}

function newRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = '';
  for (const byte of crypto.randomBytes(6)) ref += alphabet[byte % alphabet.length];
  return ref;
}

async function notify(booking) {
  if (!NOTIFY_WEBHOOK_URL) return;
  const when = `${booking.date} at ${booking.time}`;
  try {
    await fetch(NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `New booking ${booking.ref}: ${booking.service} (${booking.duration} min, $${booking.total}${booking.firstVisit ? ', first visit' : ''}) on ${when} for ${booking.name}, ${booking.phone}, ${booking.email}`,
        booking,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('Notification webhook failed:', err.message);
  }
}

// ---------- Routes ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // Public API
  if (p === '/api/config' && req.method === 'GET') {
    return send(res, 200, {
      timezone: config.timezone,
      hours: getAvailability().hours,
      maxDaysAhead: getAvailability().maxDaysAhead,
      today: nowLocal().date,
      currency: config.currency,
      newClientDiscountPercent: config.newClientDiscountPercent,
      services: config.services,
    });
  }

  if (p === '/api/availability' && req.method === 'GET') {
    const service = findService(url.searchParams.get('service') || '');
    const duration = Number(url.searchParams.get('duration'));
    const date = url.searchParams.get('date') || '';
    if (!service || !service.durations.includes(duration) || !isValidDate(date)) {
      return send(res, 400, { error: 'Invalid service, duration or date.' });
    }
    return send(res, 200, { date, slots: availableSlots(date, duration) }, { 'Cache-Control': 'no-store' });
  }

  if (p === '/api/bookings' && req.method === 'POST') {
    if (rateLimited(clientIp(req))) return send(res, 429, { error: 'Too many booking attempts. Please call us instead.' });
    const body = await readJson(req);
    if (body.website) return send(res, 201, { ref: newRef() }); // honeypot: pretend success for bots
    const { errors, value: v } = validateBooking(body);
    if (Object.keys(errors).length) return send(res, 400, { error: 'Please check the highlighted fields.', fields: errors });

    const start = toMin(v.time);
    const ref = newRef();
    const q$ = quote(v.service, v.duration, v.firstVisit);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!availableSlots(v.date, v.duration).includes(v.time)) {
        db.exec('ROLLBACK');
        return send(res, 409, { error: 'Sorry, that time was just taken. Please pick another.' });
      }
      q.insertBooking.run(ref, v.service.id, v.service.name, v.duration, v.date, start, start + v.duration,
        v.name, v.phone, v.email, v.notes, q$.price, q$.total, v.firstVisit ? 1 : 0);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    const booking = {
      ref, service: v.service.name, duration: v.duration, date: v.date, time: v.time,
      name: v.name, phone: v.phone, email: v.email, notes: v.notes,
      price: q$.price, total: q$.total, firstVisit: v.firstVisit, discountPercent: q$.discountPercent,
    };
    notify(booking);
    return send(res, 201, booking);
  }

  // Admin
  if (p === '/admin/login' && req.method === 'GET') {
    if (!ADMIN_PASSWORD) return send(res, 503, 'Admin is disabled. Set the ADMIN_PASSWORD environment variable.');
    if (isAdmin(req)) return redirect(res, '/admin');
    const m = url.searchParams;
    return serveLogin(res, m.has('error') ? 'That password didn&rsquo;t match. Please try again.'
      : m.has('locked') ? 'Too many attempts. Please wait 15 minutes and try again.'
      : m.has('out') ? 'You&rsquo;re signed out.' : '');
  }

  if (p === '/admin/login' && req.method === 'POST') {
    if (!ADMIN_PASSWORD) return send(res, 503, 'Admin is disabled.');
    // Only wrong passwords count towards the lockout: 10 failures in 15 minutes.
    const ip = clientIp(req);
    const recent = (loginFailures.get(ip) || []).filter((t) => Date.now() - t < 15 * 60 * 1000);
    if (recent.length >= 10) return redirect(res, '/admin/login?locked=1');
    const form = await readForm(req);
    if (!passwordMatches(form.password || '')) {
      loginFailures.set(ip, [...recent, Date.now()]);
      return redirect(res, '/admin/login?error=1');
    }
    loginFailures.delete(ip);
    return redirect(res, '/admin', { 'Set-Cookie': sessionCookie(req, newSession(), SESSION_HOURS * 3600) });
  }

  if (p === '/admin/logout' && req.method === 'POST') {
    return redirect(res, '/admin/login?out=1', { 'Set-Cookie': sessionCookie(req, '', 0) });
  }

  if (p === '/admin' || p === '/admin/') {
    if (!requireAdmin(req, res, { page: true })) return;
    return serveFile(res, path.join(__dirname, 'admin', 'index.html'));
  }

  if (p.startsWith('/api/admin/')) {
    if (!requireAdmin(req, res)) return;
    let m;

    if (p === '/api/admin/bookings' && req.method === 'GET') {
      const from = url.searchParams.get('from') || nowLocal().date;
      const to = url.searchParams.get('to') || addDays(from, 30);
      if (!isValidDate(from) || !isValidDate(to)) return send(res, 400, { error: 'Invalid date range.' });
      const rows = q.listBookings.all(from, to).map((r) => ({ ...r, time: fmtMin(r.start_min), end: fmtMin(r.end_min) }));
      return send(res, 200, { from, to, bookings: rows }, { 'Cache-Control': 'no-store' });
    }

    if ((m = p.match(/^\/api\/admin\/bookings\/(\d+)\/cancel$/)) && req.method === 'POST') {
      const r = q.cancelBooking.run(Number(m[1]));
      return r.changes ? send(res, 200, { ok: true }) : send(res, 404, { error: 'Booking not found or already cancelled.' });
    }

    if (p === '/api/admin/availability' && req.method === 'GET') {
      const saved = !!q.getSetting.get('availability');
      return send(res, 200, { ...getAvailability(), saved, defaults: defaultAvailability(), slotSteps: SLOT_STEPS }, { 'Cache-Control': 'no-store' });
    }

    if (p === '/api/admin/availability' && req.method === 'PUT') {
      const { errors, value } = validateAvailability(await readJson(req));
      if (errors.length) return send(res, 400, { error: errors.join(' '), errors });
      q.setSetting.run('availability', JSON.stringify(value));
      return send(res, 200, { ...value, saved: true });
    }

    if (p === '/api/admin/availability' && req.method === 'DELETE') {
      q.deleteSetting.run('availability');
      return send(res, 200, { ...defaultAvailability(), saved: false });
    }

    if (p === '/api/admin/blocks' && req.method === 'GET') {
      const rows = q.listBlocks.all(nowLocal().date).map((r) => ({ ...r, start: fmtMin(r.start_min), end: fmtMin(r.end_min) }));
      return send(res, 200, { blocks: rows }, { 'Cache-Control': 'no-store' });
    }

    if (p === '/api/admin/blocks' && req.method === 'POST') {
      const b = await readJson(req);
      const allDay = b.allDay === true;
      if (!isValidDate(b.date)) return send(res, 400, { error: 'Choose a date.' });
      if (!allDay && (!TIME_RE.test(b.start || '') || !TIME_RE.test(b.end || '') || toMin(b.end) <= toMin(b.start))) {
        return send(res, 400, { error: 'Choose a start time before the end time.' });
      }
      const start = allDay ? 0 : toMin(b.start);
      const end = allDay ? 24 * 60 : toMin(b.end);
      const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 200) : '';
      const r = q.insertBlock.run(b.date, start, end, reason);
      return send(res, 201, { id: Number(r.lastInsertRowid) });
    }

    if ((m = p.match(/^\/api\/admin\/blocks\/(\d+)$/)) && req.method === 'DELETE') {
      const r = q.deleteBlock.run(Number(m[1]));
      return r.changes ? send(res, 200, { ok: true }) : send(res, 404, { error: 'Block not found.' });
    }

    return send(res, 404, { error: 'Not found' });
  }

  if (p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });

  // Static site
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'Not found');
  return serveFile(res, file);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (err.status) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: 'Something went wrong. Please call us to book.' });
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Massage Fenix running on http://localhost:${PORT}`);
    if (!ADMIN_PASSWORD) console.log('Admin dashboard disabled: set ADMIN_PASSWORD to enable /admin');
  });
}

module.exports = { server, availableSlots };
