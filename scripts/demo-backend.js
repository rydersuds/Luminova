// In-browser stand-in for server.js, used only by the offline previews.
// It answers the same /api/* requests (by wrapping window.fetch), applies the same booking
// rules, and keeps its data in the top window (shared by the website and admin frames) and in
// localStorage when available. The build script replaces __CONFIG__ and __SAMPLE__.
(function () {
  if (window.FenixDemo) return;
  var CONFIG = __CONFIG__;
  var SAMPLE = __SAMPLE__;
  var KEY = 'fenix-demo-v1';

  // ---------- Who holds the data ----------
  // The outermost preview page owns the demo data. Embedded preview frames (the admin inside the
  // website, the tabs of the all-in-one preview) send their requests to their parent with
  // postMessage, which works even when the preview is shown inside a locked-down frame. A frame
  // whose parent doesn't answer within 400 ms becomes the owner itself.
  var demo = { data: null };
  var mode = new Promise(function (resolve) {
    if (window.parent === window) return resolve('owner');
    var id = 'ping-' + Math.random(), settled = false;
    function onPong(e) {
      if (e.source === window.parent && e.data && e.data.fenixDemo === 'pong' && e.data.id === id) {
        settled = true; removeEventListener('message', onPong); resolve('child');
      }
    }
    addEventListener('message', onPong);
    try { window.parent.postMessage({ fenixDemo: 'ping', id: id }, '*'); } catch (e) { /* ignore */ }
    setTimeout(function () { if (!settled) { removeEventListener('message', onPong); resolve('owner'); } }, 400);
  });
  mode.then(function (m) { if (m === 'owner') demo.data = load() || seed(), save(); });

  function save() { try { localStorage.setItem(KEY, JSON.stringify(demo.data)); } catch (e) { /* storage unavailable */ } }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
    return null;
  }
  function seed() {
    var today = nowLocal().date;
    var data = { bookings: [], blocks: [], availability: null, nextId: 1 };
    SAMPLE.bookings.forEach(function (b) {
      var svc = findService(b.service);
      var start = toMin(b.time);
      data.bookings.push({
        id: data.nextId++, ref: b.ref, service_id: svc.id, service_name: svc.name, duration: b.duration,
        date: addDays(today, b.day), start_min: start, end_min: start + b.duration,
        name: b.name, phone: b.phone, email: b.email, notes: b.notes || '', status: b.status || 'confirmed',
        price: svc.prices[b.duration], total: quote(svc, b.duration, b.firstVisit).total, first_visit: b.firstVisit ? 1 : 0,
      });
    });
    SAMPLE.blocks.forEach(function (b) {
      data.blocks.push({ id: data.nextId++, date: addDays(today, b.day), start_min: b.allDay ? 0 : toMin(b.start), end_min: b.allDay ? 1440 : toMin(b.end), reason: b.reason });
    });
    return data;
  }

  // ---------- Time helpers (studio local time) ----------
  function toMin(hhmm) { return +hhmm.slice(0, 2) * 60 + +hhmm.slice(3); }
  function fmtMin(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function dow(d) { return new Date(d + 'T12:00:00Z').getUTCDay(); }
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s; }
  function nowLocal() {
    var p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, min: +p.hour * 60 + +p.minute };
  }

  // ---------- Booking rules (mirrors server.js) ----------
  function findService(id) { return CONFIG.services.filter(function (s) { return s.id === id; })[0]; }
  function quote(svc, duration, first) {
    var price = svc.prices[duration], pct = first ? CONFIG.newClientDiscountPercent : 0;
    return { price: price, total: Math.round(price * (100 - pct)) / 100 };
  }
  function availability() {
    var a = demo.data.availability || {};
    return {
      hours: a.hours || CONFIG.hours,
      slotStepMinutes: a.slotStepMinutes || CONFIG.slotStepMinutes,
      bufferMinutes: a.bufferMinutes != null ? a.bufferMinutes : CONFIG.bufferMinutes,
      minNoticeMinutes: a.minNoticeMinutes != null ? a.minNoticeMinutes : CONFIG.minNoticeMinutes,
      maxDaysAhead: a.maxDaysAhead || CONFIG.maxDaysAhead,
    };
  }
  function slots(date, duration) {
    if (!validDate(date)) return [];
    var a = availability(), now = nowLocal();
    if (date < now.date || date > addDays(now.date, a.maxDaysAhead)) return [];
    var h = a.hours[dow(date)];
    if (!h) return [];
    var busy = [];
    demo.data.bookings.forEach(function (b) { if (b.date === date && b.status === 'confirmed') busy.push([b.start_min - a.bufferMinutes, b.end_min + a.bufferMinutes]); });
    demo.data.blocks.forEach(function (b) { if (b.date === date) busy.push([b.start_min, b.end_min]); });
    var earliest = date === now.date ? now.min + a.minNoticeMinutes : -1, out = [];
    for (var t = toMin(h[0]); t + duration <= toMin(h[1]); t += a.slotStepMinutes) {
      if (t < earliest) continue;
      if (busy.some(function (r) { return t < r[1] && t + duration > r[0]; })) continue;
      out.push(fmtMin(t));
    }
    return out;
  }
  function newRef() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
    for (var i = 0; i < 6; i++) r += A[Math.floor(Math.random() * A.length)];
    return r;
  }

  // ---------- Routes ----------
  function json(status, body) { return { status: status, body: body }; }
  function route(method, url, body) {
    var p = url.pathname, q = url.searchParams, m, d = demo.data;
    if (p === '/api/__demo/reset') { demo.data = seed(); save(); return json(200, { ok: true }); }
    if (p === '/api/config') {
      var a = availability();
      return json(200, { timezone: CONFIG.timezone, hours: a.hours, maxDaysAhead: a.maxDaysAhead, today: nowLocal().date, currency: CONFIG.currency, newClientDiscountPercent: CONFIG.newClientDiscountPercent, services: CONFIG.services });
    }
    if (p === '/api/availability') {
      var svc = findService(q.get('service')), dur = +q.get('duration');
      if (!svc || svc.durations.indexOf(dur) < 0 || !validDate(q.get('date'))) return json(400, { error: 'Invalid service, duration or date.' });
      return json(200, { date: q.get('date'), slots: slots(q.get('date'), dur) });
    }
    if (p === '/api/bookings' && method === 'POST') {
      var s2 = findService(body.service), dur2 = +body.duration;
      if (!s2 || s2.durations.indexOf(dur2) < 0) return json(400, { error: 'Please choose a service and length.' });
      if (slots(body.date, dur2).indexOf(body.time) < 0) return json(409, { error: 'Sorry, that time was just taken. Please pick another.' });
      var start = toMin(body.time), qte = quote(s2, dur2, body.firstVisit === true), ref = newRef();
      d.bookings.push({ id: d.nextId++, ref: ref, service_id: s2.id, service_name: s2.name, duration: dur2, date: body.date, start_min: start, end_min: start + dur2,
        name: String(body.name || '').trim(), phone: String(body.phone || '').trim(), email: String(body.email || '').trim(), notes: String(body.notes || '').trim(),
        status: 'confirmed', price: qte.price, total: qte.total, first_visit: body.firstVisit ? 1 : 0 });
      save();
      return json(201, { ref: ref, service: s2.name, duration: dur2, date: body.date, time: body.time, price: qte.price, total: qte.total, firstVisit: body.firstVisit === true });
    }
    if (p === '/api/admin/bookings') {
      var from = q.get('from') || nowLocal().date, to = q.get('to') || addDays(from, 30);
      var rows = d.bookings.filter(function (b) { return b.date >= from && b.date <= to; })
        .sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : x.start_min - y.start_min; })
        .map(function (b) { return Object.assign({}, b, { time: fmtMin(b.start_min), end: fmtMin(b.end_min) }); });
      return json(200, { from: from, to: to, bookings: rows });
    }
    if ((m = p.match(/^\/api\/admin\/bookings\/(\d+)\/cancel$/)) && method === 'POST') {
      var bk = d.bookings.filter(function (b) { return b.id === +m[1] && b.status === 'confirmed'; })[0];
      if (!bk) return json(404, { error: 'Booking not found or already cancelled.' });
      bk.status = 'cancelled'; save();
      return json(200, { ok: true });
    }
    if (p === '/api/admin/blocks' && method === 'GET') {
      var today = nowLocal().date;
      return json(200, { blocks: d.blocks.filter(function (b) { return b.date >= today; })
        .sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : x.start_min - y.start_min; })
        .map(function (b) { return Object.assign({}, b, { start: fmtMin(b.start_min), end: fmtMin(b.end_min) }); }) });
    }
    if (p === '/api/admin/blocks' && method === 'POST') {
      if (!validDate(body.date)) return json(400, { error: 'Choose a date.' });
      var all = body.allDay === true;
      if (!all && (!/^\d\d:\d\d$/.test(body.start || '') || !/^\d\d:\d\d$/.test(body.end || '') || toMin(body.end) <= toMin(body.start))) return json(400, { error: 'Choose a start time before the end time.' });
      d.blocks.push({ id: d.nextId++, date: body.date, start_min: all ? 0 : toMin(body.start), end_min: all ? 1440 : toMin(body.end), reason: String(body.reason || '').slice(0, 200) });
      save();
      return json(201, { id: d.nextId - 1 });
    }
    if ((m = p.match(/^\/api\/admin\/blocks\/(\d+)$/)) && method === 'DELETE') {
      var before = d.blocks.length;
      d.blocks = d.blocks.filter(function (b) { return b.id !== +m[1]; }); save();
      return d.blocks.length < before ? json(200, { ok: true }) : json(404, { error: 'Block not found.' });
    }
    if (p === '/api/admin/availability') {
      var defaults = { hours: CONFIG.hours, slotStepMinutes: CONFIG.slotStepMinutes, bufferMinutes: CONFIG.bufferMinutes, minNoticeMinutes: CONFIG.minNoticeMinutes, maxDaysAhead: CONFIG.maxDaysAhead };
      if (method === 'GET') return json(200, Object.assign(availability(), { saved: !!d.availability, defaults: defaults, slotSteps: [15, 20, 30, 60] }));
      if (method === 'DELETE') { d.availability = null; save(); return json(200, Object.assign(availability(), { saved: false })); }
      if (method === 'PUT') {
        var errors = [], hours = {};
        for (var day = 0; day < 7; day++) {
          var h = body.hours && (body.hours[day] !== undefined ? body.hours[day] : body.hours[String(day)]);
          if (!h) { hours[day] = null; continue; }
          if (toMin(h[1]) - toMin(h[0]) < 30) { errors.push(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] + ': closing must be at least 30 minutes after opening.'); continue; }
          hours[day] = [h[0], h[1]];
        }
        if (!errors.length && Object.keys(hours).every(function (k) { return !hours[k]; })) errors.push('Open at least one day a week.');
        if (errors.length) return json(400, { error: errors.join(' '), errors: errors });
        d.availability = { hours: hours, slotStepMinutes: +body.slotStepMinutes, bufferMinutes: +body.bufferMinutes, minNoticeMinutes: +body.minNoticeMinutes, maxDaysAhead: +body.maxDaysAhead };
        save();
        return json(200, Object.assign(availability(), { saved: true }));
      }
    }
    return json(404, { error: 'Not found' });
  }

  // ---------- Plumbing ----------
  var pending = {}, seq = 0;
  function call(method, url, body) {
    return mode.then(function (m) {
      if (m === 'owner') return route(method, new URL(url, 'http://demo.local'), body || {});
      return new Promise(function (resolve) {
        var id = 'r' + (++seq) + '-' + Math.random();
        pending[id] = resolve;
        window.parent.postMessage({ fenixDemo: 'req', id: id, method: method, url: url, body: body || {} }, '*');
      });
    });
  }
  addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || !msg.fenixDemo) return;
    if (msg.fenixDemo === 'ping' && e.source) e.source.postMessage({ fenixDemo: 'pong', id: msg.id }, '*');
    else if (msg.fenixDemo === 'req' && e.source) {
      var src = e.source;
      call(msg.method, msg.url, msg.body).then(function (r) { src.postMessage({ fenixDemo: 'res', id: msg.id, status: r.status, body: r.body }, '*'); });
    } else if (msg.fenixDemo === 'res' && pending[msg.id]) {
      pending[msg.id]({ status: msg.status, body: msg.body }); delete pending[msg.id];
    }
  });

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : (input && input.url) || '';
    if (!/^\/api\//.test(u)) return realFetch ? realFetch(input, init) : Promise.reject(new Error('offline'));
    init = init || {};
    var body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch (e) { body = {}; }
    return call((init.method || 'GET').toUpperCase(), u, body).then(function (r) {
      return new Promise(function (res) { setTimeout(function () { res(new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } })); }, 100); });
    });
  };
  window.FenixDemo = { reset: function () { return call('POST', '/api/__demo/reset', {}); } };
  window.STUDIO_HOURS = CONFIG.hours; // refreshed from /api/config once the page loads
})();
