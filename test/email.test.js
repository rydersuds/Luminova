const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { buildMessage } = require('../mailer');

// A tiny fake mail server that records what it receives.
const received = [];
const fake = net.createServer((sock) => {
  const mail = { auth: null, from: null, to: [], data: '' };
  let inData = false, buf = '';
  sock.write('220 fake.test ready\r\n');
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    if (inData) {
      const end = buf.indexOf('\r\n.\r\n');
      if (end === -1) return;
      mail.data = buf.slice(0, end); buf = buf.slice(end + 5); inData = false;
      received.push(mail);
      sock.write('250 queued\r\n');
    }
    let i;
    while (!inData && (i = buf.indexOf('\r\n')) !== -1) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (/^EHLO/i.test(line)) sock.write('250-fake.test\r\n250-SIZE 1000000\r\n250 AUTH PLAIN LOGIN\r\n');
      else if (/^AUTH PLAIN /i.test(line)) { mail.auth = Buffer.from(line.slice(11), 'base64').toString('utf8').split('\0'); sock.write('235 ok\r\n'); }
      else if (/^MAIL FROM:/i.test(line)) { mail.from = line.slice(10); sock.write('250 ok\r\n'); }
      else if (/^RCPT TO:/i.test(line)) { mail.to.push(line.slice(8)); sock.write('250 ok\r\n'); }
      else if (/^DATA/i.test(line)) { inData = true; sock.write('354 go ahead\r\n'); }
      else if (/^QUIT/i.test(line)) { sock.end('221 bye\r\n'); }
      else sock.write('500 what?\r\n');
    }
  });
});

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fenix-email-test-'));
let server, base;
const auth = { Authorization: 'Basic ' + Buffer.from('admin:secret').toString('base64') };

// A fake Brevo API: records requests; the API key picks the reply.
const http = require('node:http');
const brevoCalls = [];
const brevo = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const key = req.headers['api-key'];
    brevoCalls.push({ key, body: JSON.parse(body) });
    const reply = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (key === 'xkeysib-good-0123456789abcdef') return reply(201, { messageId: '<1@brevo>' });
    if (key === 'xkeysib-ip-0123456789abcdefgh') return reply(401, { code: 'unauthorized', message: 'We have detected you are using an unrecognised IP address 1.2.3.4' });
    if (key === 'xkeysib-sender-0123456789abcd') return reply(400, { code: 'invalid_parameter', message: 'Sending has been rejected because the sender you used x@example.com is not valid. Validate your sender or authenticate your domain' });
    return reply(401, { code: 'unauthorized', message: 'Key not found' });
  });
});

before(async () => {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  await new Promise((r) => brevo.listen(0, '127.0.0.1', r));
  process.env.BREVO_API_URL = `http://127.0.0.1:${brevo.address().port}/v3/smtp/email`;
  Object.assign(process.env, {
    DATA_DIR: dataDir, ADMIN_PASSWORD: 'secret', NOTIFY_WEBHOOK_URL: '',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: String(fake.address().port),
    SMTP_USER: 'bookings@example.com', SMTP_PASS: 'abcd efgh ijkl mnop',
    NOTIFY_EMAIL: 'felix@example.com, front-desk@example.com', SITE_URL: 'https://massagecalgary.ca/',
  });
  ({ server } = require('../server'));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fake.close(); brevo.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const decodeBody = (data) => Buffer.from(data.split('\r\n\r\n').slice(1).join('').replace(/\s+/g, ''), 'base64').toString('utf8');
const waitForMail = async (n) => { for (let i = 0; i < 100 && received.length < n; i++) await new Promise((r) => setTimeout(r, 20)); };

function nextWeekday(dow) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

test('a new booking emails the studio', async () => {
  const date = nextWeekday(3);
  const { slots } = await (await fetch(`${base}/api/availability?service=therapeutic&duration=60&date=${date}`)).json();
  const res = await fetch(base + '/api/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service: 'therapeutic', duration: 60, date, time: slots[0], name: 'Zoë Client', phone: '403 555 0199', email: 'zoe@example.com', notes: 'Left shoulder', firstVisit: true }),
  });
  assert.equal(res.status, 201);
  const booking = await res.json();
  await waitForMail(1);
  assert.equal(received.length, 1);
  const mail = received[0];
  assert.deepEqual(mail.auth, ['', 'bookings@example.com', 'abcdefghijklmnop'], 'logs in, with spaces removed from the app password');
  assert.equal(mail.from, '<bookings@example.com>');
  assert.deepEqual(mail.to, ['<felix@example.com>', '<front-desk@example.com>']);
  const head = mail.data.split('\r\n\r\n')[0];
  assert.ok(head.split('\r\n').every((l) => l.length <= 78), 'header lines stay short');
  const subject = head.match(/^Subject: ((?:.*)(?:\r\n .*)*)/m)[1].split('\r\n ')
    .map((w) => Buffer.from(w.match(/^=\?UTF-8\?B\?(.*)\?=$/)[1], 'base64').toString('utf8')).join('');
  assert.match(subject, /^New booking: Therapeutic massage, \w+day, \w+ \d+ at \d+:\d\d [ap]m \(Zoë Client\)$/);
  assert.match(mail.data, /^Reply-To: =\?UTF-8\?B\?[^?]+\?= <zoe@example\.com>$/m, 'replying writes to the client');
  const body = decodeBody(mail.data);
  for (const bit of ['Zoë Client', '403 555 0199', 'zoe@example.com', 'Therapeutic massage, 60 min', '$108 (first visit, 10% off $120)', 'Left shoulder', booking.ref, 'https://massagecalgary.ca/admin']) {
    assert.ok(body.includes(bit), `email mentions ${bit}`);
  }
});

test('staff can check the email setup and send a test', async () => {
  assert.equal((await fetch(base + '/api/admin/email')).status, 401);
  assert.equal((await fetch(base + '/api/admin/email/test', { method: 'POST' })).status, 401);
  const status = await (await fetch(base + '/api/admin/email', { headers: auth })).json();
  assert.deepEqual([status.on, status.source, status.to, status.hasPassword, 'pass' in status], [true, 'env', ['felix@example.com', 'front-desk@example.com'], true, false]);
  const before = received.length;
  const res = await fetch(base + '/api/admin/email/test', { method: 'POST', headers: auth });
  assert.equal(res.status, 200);
  await waitForMail(before + 1);
  assert.match(received[before].data, /^Subject: Test: booking emails are working$/m);
  assert.equal((await fetch(base + '/api/admin/email/test', { method: 'POST', headers: auth })).status, 429, 'tests are rate limited');
});

test('client details cannot add email headers', () => {
  const msg = buildMessage({ from: 'Site <a@example.com>', to: ['b@example.com'], replyTo: 'Evil\r\nBcc: x@example.com <c@example.com>', subject: 'Hi\r\nBcc: y@example.com', text: 'x' });
  const headers = msg.split('\r\n\r\n')[0].split('\r\n');
  assert.ok(!headers.some((h) => /^Bcc:/i.test(h)), headers.join(' | '));
});

test('staff can set up booking emails in the admin', async () => {
  const put = (body) => fetch(base + '/api/admin/email', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await fetch(base + '/api/admin/email', { method: 'PUT', body: '{}' })).status, 401);
  const port = fake.address().port;
  const bad = await put({ to: 'not-an-email', user: '', pass: '', host: 'smtp gmail', port: 99 });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).errors.length, 5);

  const res = await put({ to: 'owner@example.com, ', user: 'site@example.com', pass: 'abcd efgh', host: '127.0.0.1', port: 2526 });
  assert.equal(res.status, 400, 'only standard mail ports');
  // The fake server listens on a random port; save a normal port, then point the saved setting at it.
  const ok = await put({ to: 'owner@example.com', user: 'site@example.com', pass: 'abcd efgh', host: 'localhost', port: 587 });
  assert.equal(ok.status, 200);
  const shown = await ok.json();
  assert.deepEqual(shown, { on: true, source: 'admin', service: 'smtp', to: ['owner@example.com'], host: 'localhost', port: 587, user: 'site@example.com', hasPassword: true });
  assert.ok(!JSON.stringify(await (await fetch(base + '/api/admin/email', { headers: auth })).json()).includes('abcdefgh'), 'the password is never sent back');

  // Leaving the password blank keeps the saved one (same account).
  assert.equal((await put({ to: 'owner@example.com, second@example.com', user: 'site@example.com', pass: '', host: 'localhost', port: 587 })).status, 200);
  // ...but not for a different account.
  assert.equal((await put({ to: 'owner@example.com', user: 'other@example.com', pass: '', host: 'localhost', port: 587 })).status, 400);

  // Use the fake server's real port for the rest of the test.
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(dataDir, 'bookings.db'));
  const saved = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'email'").get().value);
  assert.equal(saved.pass, 'abcdefgh', 'spaces removed, kept from before');
  assert.equal(saved.siteUrl, 'https://massagecalgary.ca', 'a fixed SITE_URL wins over the address the admin used');
  db.prepare("UPDATE settings SET value = ? WHERE key = 'email'").run(JSON.stringify({ ...saved, port }));
  db.close();

  const before = received.length;
  const date = nextWeekday(4);
  const { slots } = await (await fetch(`${base}/api/availability?service=relaxation&duration=60&date=${date}`)).json();
  const r = await fetch(base + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service: 'relaxation', duration: 60, date, time: slots[0], name: 'Pat Doe', phone: '403 555 0123', email: 'pat@example.com' }) });
  assert.equal(r.status, 201);
  await waitForMail(before + 1);
  const mail = received[before];
  assert.deepEqual(mail.to, ['<owner@example.com>', '<second@example.com>'], 'uses the settings saved in the admin');
  assert.deepEqual(mail.auth, ['', 'site@example.com', 'abcdefgh']);
  assert.ok(decodeBody(mail.data).includes('https://massagecalgary.ca/admin'));

  // Turning it off in the admin falls back to the environment's settings.
  const off = await fetch(base + '/api/admin/email', { method: 'DELETE', headers: auth });
  assert.equal((await off.json()).source, 'env');
});

test('a failed test email says why, without a 5xx the host could hide', async () => {
  const put = (body) => fetch(base + '/api/admin/email', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const testEmail = async () => {
    await new Promise((r) => setTimeout(r, 5100)); // tests are rate limited
    return fetch(base + '/api/admin/email/test', { method: 'POST', headers: auth });
  };
  // Nothing listens on either mail port here: like a host that blocks outgoing email.
  assert.equal((await put({ to: 'owner@example.com', user: 'site@example.com', pass: 'pw', host: 'localhost', port: 465 })).status, 200);
  const blocked = await testEmail();
  assert.equal(blocked.status, 422);
  assert.match((await blocked.json()).error, /Couldn’t connect to localhost \(tried ports 465 and 587\)\. Your website’s hosting is probably blocking outgoing email/);

  // A server that refuses the login.
  const refuse = net.createServer((sock) => {
    sock.write('220 hi\r\n');
    sock.on('data', (c) => { const l = String(c); sock.write(/^EHLO/.test(l) ? '250-hi\r\n250 AUTH PLAIN\r\n' : /^AUTH/.test(l) ? '535 5.7.8 Username and Password not accepted\r\n' : '250 ok\r\n'); });
  });
  await new Promise((r) => refuse.listen(0, '127.0.0.1', r));
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(dataDir, 'bookings.db'));
  const saved = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'email'").get().value);
  db.prepare("UPDATE settings SET value = ? WHERE key = 'email'").run(JSON.stringify({ ...saved, port: refuse.address().port }));
  db.close();
  const denied = await testEmail();
  assert.equal(denied.status, 422);
  assert.match((await denied.json()).error, /didn’t accept the login\. Check the email address and password\. \(Logging in to the mail server failed: 535/);
  refuse.close();
  await fetch(base + '/api/admin/email', { method: 'DELETE', headers: auth });
});

test('booking emails can go through Brevo (works where hosting blocks email ports)', async () => {
  const put = (body) => fetch(base + '/api/admin/email', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const testEmail = async () => {
    await new Promise((r) => setTimeout(r, 5100));
    return fetch(base + '/api/admin/email/test', { method: 'POST', headers: auth });
  };
  const brevoSettings = (key) => ({ service: 'brevo', to: 'felix@outlook.com', user: 'felix@outlook.com', pass: key });

  const smtpKey = await put(brevoSettings('xsmtpsib-0123456789abcdef0123'));
  assert.equal(smtpKey.status, 400);
  assert.match((await smtpKey.json()).error, /SMTP key\. Create an API key/);

  const ok = await put(brevoSettings('xkeysib-good-0123456789abcdef'));
  assert.equal(ok.status, 200);
  const shown = await ok.json();
  assert.equal(shown.service, 'brevo');
  assert.ok(!JSON.stringify(shown).includes('xkeysib'), 'the key is never sent back');
  // Saving again with the key box left blank keeps the key.
  assert.equal((await put(brevoSettings(''))).status, 200);

  const sent = await testEmail();
  assert.equal(sent.status, 200);
  const call = brevoCalls.at(-1);
  assert.equal(call.key, 'xkeysib-good-0123456789abcdef');
  assert.deepEqual(call.body.sender, { name: 'Massage Fenix website', email: 'felix@outlook.com' });
  assert.deepEqual(call.body.to, [{ email: 'felix@outlook.com' }]);
  assert.match(call.body.subject, /^Test: booking emails are working$/);

  // A booking goes through Brevo, with replies going to the client.
  const date = nextWeekday(5);
  const { slots } = await (await fetch(`${base}/api/availability?service=cupping&duration=60&date=${date}`)).json();
  const r = await fetch(base + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service: 'cupping', duration: 60, date, time: slots[0], name: 'Lee Brown', phone: '403 555 0177', email: 'lee@example.com' }) });
  assert.equal(r.status, 201);
  for (let i = 0; i < 50 && brevoCalls.at(-1) === call; i++) await new Promise((x) => setTimeout(x, 20));
  const b = brevoCalls.at(-1).body;
  assert.deepEqual(b.replyTo, { name: 'Lee Brown', email: 'lee@example.com' });
  assert.match(b.subject, /^New booking: Cupping \(vacuum\), .+ \(Lee Brown\)$/);
  assert.match(b.textContent, /Lee Brown[\s\S]*403 555 0177[\s\S]*Cupping \(vacuum\), 60 min/);

  // Brevo's common problems come back as clear steps.
  const cases = [
    ['xkeysib-ip-0123456789abcdefgh', /Authorised IPs/],
    ['xkeysib-sender-0123456789abcd', /Senders, Domains & Dedicated IPs/],
    ['xkeysib-wrong-0123456789abcde', /didn’t accept the API key/],
  ];
  for (const [key, re] of cases) {
    assert.equal((await put(brevoSettings(key))).status, 200);
    const res = await testEmail();
    assert.equal(res.status, 422);
    assert.match((await res.json()).error, re);
  }
  await fetch(base + '/api/admin/email', { method: 'DELETE', headers: auth });
});
