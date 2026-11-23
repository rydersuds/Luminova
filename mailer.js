'use strict';
// Minimal SMTP client for booking notification emails. No dependencies.
// Port 465 uses TLS from the start; other ports (587, 25) upgrade with STARTTLS.
// A password is only ever sent over an encrypted connection (or to this same machine).

const net = require('node:net');
const tls = require('node:tls');
const os = require('node:os');
const crypto = require('node:crypto');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const clean = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
const addressOf = (s) => { const m = clean(s).match(/<([^<>\s]+@[^<>\s]+)>\s*$/); return m ? m[1] : clean(s); };
// Encode a header value as UTF-8 if it isn't plain ASCII (RFC 2047), in short pieces
// on folded lines so no header line gets too long.
function encodeWord(s) {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const words = [];
  let chunk = '';
  for (const ch of s) {
    if (Buffer.byteLength(chunk + ch) > 42) { words.push(chunk); chunk = ''; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`).join('\r\n ');
}
const encodeAddress = (s) => {
  const m = clean(s).match(/^(.*?)\s*<([^<>]+)>$/);
  return m && m[1] ? `${encodeWord(m[1].replace(/^"|"$/g, ''))} <${m[2]}>` : clean(s);
};

function buildMessage({ from, to, replyTo, subject, text }) {
  const domain = (addressOf(from).split('@')[1] || 'localhost').replace(/[^\w.-]/g, '');
  const headers = [
    `From: ${encodeAddress(from)}`,
    `To: ${to.map(encodeAddress).join(', ')}`,
    replyTo ? `Reply-To: ${encodeAddress(replyTo)}` : null,
    `Subject: ${encodeWord(clean(subject))}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean);
  const body = Buffer.from(String(text).replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${body}\r\n`;
}

// Reads SMTP replies (including multi-line ones) from a socket, one at a time.
function replyReader(socket) {
  let buf = '';
  let waiting = null;
  const ready = [];
  const onData = (chunk) => {
    buf += chunk.toString('utf8');
    let m;
    // A reply is done when a line has a space (not a dash) after the code.
    while ((m = buf.match(/^((?:\d{3}-[^\n]*\n)*)(\d{3}) ([^\n]*)\n/))) {
      buf = buf.slice(m[0].length);
      const reply = { code: Number(m[2]), text: (m[1] + m[2] + ' ' + m[3]).replace(/\r/g, '').trim() };
      if (waiting) { const w = waiting; waiting = null; w.resolve(reply); } else ready.push(reply);
    }
  };
  const fail = (err) => { if (waiting) { const w = waiting; waiting = null; w.reject(err); } };
  return {
    attach(s) {
      s.on('data', onData);
      s.on('error', fail);
      s.on('close', () => fail(new Error('The mail server closed the connection.')));
    },
    detach(s) { s.removeListener('data', onData); },
    next: () => (ready.length ? Promise.resolve(ready.shift()) : new Promise((resolve, reject) => { waiting = { resolve, reject }; })),
  };
}

async function sendMail(opts) {
  const { host, port = 465, user, pass, from, to, replyTo, subject, text, timeoutMs = 20000 } = opts;
  const recipients = (Array.isArray(to) ? to : String(to).split(',')).map(addressOf).filter(Boolean);
  if (!host || !from || !recipients.length) throw new Error('Email is not set up: SMTP_HOST, a from address and NOTIFY_EMAIL are needed.');
  const local = LOCAL_HOSTS.has(host);
  const implicitTls = Number(port) === 465;

  let socket = implicitTls
    ? tls.connect({ host, port: Number(port), servername: net.isIP(host) ? undefined : host })
    : net.connect({ host, port: Number(port) });
  socket.setTimeout(timeoutMs, () => socket.destroy(new Error('The mail server took too long to answer.')));
  let reader = replyReader(socket);
  reader.attach(socket);
  let encrypted = implicitTls;

  const expect = async (codes, what) => {
    const r = await reader.next();
    if (!codes.includes(r.code)) throw new Error(`${what} failed: ${r.text}`);
    return r;
  };
  const cmd = (line, codes, what) => { socket.write(line + '\r\n'); return expect(codes, what || line.split(' ')[0]); };

  try {
    // Mark failures before the server's greeting, so callers can tell "couldn't connect"
    // (often a blocked port) from "connected, but something was refused".
    await expect([220], 'Connecting to the mail server').catch((err) => { err.stage = 'connect'; throw err; });
    const helo = os.hostname().replace(/[^\w.-]/g, '') || 'localhost';
    let ehlo = await cmd(`EHLO ${helo}`, [250]);
    if (!encrypted && /STARTTLS/i.test(ehlo.text)) {
      await cmd('STARTTLS', [220]);
      reader.detach(socket);
      socket = tls.connect({ socket, servername: net.isIP(host) ? undefined : host });
      socket.setTimeout(timeoutMs, () => socket.destroy(new Error('The mail server took too long to answer.')));
      await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
      reader = replyReader(socket);
      reader.attach(socket);
      encrypted = true;
      ehlo = await cmd(`EHLO ${helo}`, [250]);
    }
    if (user) {
      if (!encrypted && !local) throw new Error('The mail server does not offer encryption, so the password was not sent. Use port 465 or 587.');
      if (/AUTH[ =][^\n]*PLAIN/i.test(ehlo.text)) {
        await cmd(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass || ''}`).toString('base64')}`, [235], 'Logging in to the mail server');
      } else {
        await cmd('AUTH LOGIN', [334], 'Logging in to the mail server');
        await cmd(Buffer.from(user).toString('base64'), [334], 'Logging in to the mail server');
        await cmd(Buffer.from(pass || '').toString('base64'), [235], 'Logging in to the mail server');
      }
    }
    await cmd(`MAIL FROM:<${addressOf(from)}>`, [250], 'Sender address');
    for (const r of recipients) await cmd(`RCPT TO:<${r}>`, [250, 251], `Recipient ${r}`);
    await cmd('DATA', [354]);
    socket.write(buildMessage({ from, to: recipients, replyTo, subject, text }) + '.\r\n');
    await expect([250], 'Sending the message');
    socket.write('QUIT\r\n');
  } finally {
    socket.setTimeout(0);
    setTimeout(() => socket.destroy(), 1000).unref();
    socket.end();
  }
}

module.exports = { sendMail, buildMessage };
