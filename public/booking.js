// Online booking widget. Talks to the /api endpoints in server.js.
// When window.BOOKING_DEMO holds a config object (static preview build), a local mock stands in for the server.
(function () {
  var root = document.querySelector('[data-booker]');
  if (!root) return;

  var $ = function (sel, el) { return (el || root).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); };

  document.documentElement.classList.add('js');
  var modal = document.getElementById('booking');
  var panel = modal.querySelector('.bk-panel');
  var lastFocus = null;
  var steps = $$('.bk-step');
  var alertBox = $('.bk-alert');
  var form = $('form.bk-step');
  var state = { step: 1, service: null, duration: null, date: null, time: null, booking: null };
  var cfg = null;
  var pendingService = null;
  var pendingDuration = null;
  var slotReq = 0;

  // ---------- API ----------
  var api = window.BOOKING_DEMO ? demoApi(window.BOOKING_DEMO) : {
    config: function () { return getJson('/api/config'); },
    slots: function (service, duration, date) {
      return getJson('/api/availability?service=' + encodeURIComponent(service) + '&duration=' + duration + '&date=' + date)
        .then(function (r) { return r.slots; });
    },
    book: function (payload) {
      return fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw Object.assign(new Error(body.error || 'Booking failed.'), { status: res.status, fields: body.fields });
          return body;
        });
      });
    },
  };

  function getJson(url) {
    return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('Request failed');
      return r.json();
    });
  }

  // ---------- Formatting ----------
  function parseDate(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)); }
  function addDays(s, n) { var d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function fmtDate(s, opts) { return parseDate(s).toLocaleDateString('en-CA', Object.assign({ timeZone: 'UTC' }, opts)); }
  function fmtTime(hhmm) {
    var h = +hhmm.slice(0, 2), m = hhmm.slice(3);
    return ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'am' : 'pm');
  }
  function money(n) { return '$' + (n % 1 ? n.toFixed(2) : String(n)); }
  function fromPrice(svc) { return Math.min.apply(null, svc.durations.map(function (d) { return svc.prices[d]; })); }
  function quote() {
    var price = serviceObj().prices[state.duration];
    var pct = form.elements.firstVisit.checked ? (cfg.newClientDiscountPercent || 0) : 0;
    return { price: price, pct: pct, total: Math.round(price * (100 - pct)) / 100 };
  }
  function fmtLong(s) { return fmtDate(s, { weekday: 'long', month: 'long', day: 'numeric' }); }
  function serviceObj() { return cfg.services.filter(function (s) { return s.id === state.service; })[0]; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- UI ----------
  function showAlert(msg) {
    alertBox.textContent = msg || '';
    alertBox.hidden = !msg;
  }

  function go(step) {
    state.step = step;
    steps.forEach(function (el) { el.hidden = Number(el.dataset.step) !== step; });
    $$('[data-progress]').forEach(function (li) {
      var n = Number(li.dataset.progress);
      li.classList.toggle('is-current', n === step);
      li.classList.toggle('is-done', n < step);
      if (n === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    showAlert('');
    if (step === 2) renderDays();
    if (step === 3) renderSummary();
    if (panel) panel.scrollTop = 0;
  }

  function syncNext() {
    var s1 = $('[data-step="1"] [data-next]');
    var s2 = $('[data-step="2"] [data-next]');
    s1.disabled = !(state.service && state.duration);
    s2.disabled = !(state.date && state.time);
  }

  function renderServices() {
    var wrap = $('[data-services]');
    wrap.innerHTML = cfg.services.map(function (s) {
      return '<label class="bk-option"><input type="radio" name="bk-service" value="' + esc(s.id) + '"><span>' + esc(s.name) + '<small>from ' + money(fromPrice(s)) + '</small></span></label>';
    }).join('');
    wrap.addEventListener('change', function (e) {
      if (e.target.name === 'bk-service') selectService(e.target.value);
    });
  }

  function selectService(id) {
    var radio = $$('input[name="bk-service"]').filter(function (r) { return r.value === id; })[0];
    if (!radio) return;
    radio.checked = true;
    state.service = id;
    var svc = serviceObj();
    if (svc.durations.indexOf(state.duration) === -1) state.duration = svc.durations.length === 1 ? svc.durations[0] : null;
    state.time = null;
    var pills = $('[data-durations]');
    pills.innerHTML = svc.durations.map(function (d) {
      return '<label class="bk-option"><input type="radio" name="bk-duration" value="' + d + '"' + (d === state.duration ? ' checked' : '') + '><span>' + d + ' min<small>' + money(svc.prices[d]) + '</small></span></label>';
    }).join('');
    $('.bk-durations-wrap').hidden = false;
    syncNext();
    if (modal.classList.contains('is-open')) {
      $('.bk-durations-wrap').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function selectDuration(d) {
    var r = $$('input[name="bk-duration"]').filter(function (x) { return Number(x.value) === d; })[0];
    if (!r) return;
    r.checked = true;
    state.duration = d;
    state.time = null;
    syncNext();
  }

  function renderDays() {
    var days = $('[data-days]');
    var html = '';
    for (var i = 0; i < 14; i++) {
      var d = addDays(cfg.today, i);
      var closed = !cfg.hours[parseDate(d).getUTCDay()];
      if (closed) continue;
      html += '<button type="button" class="bk-day" data-date="' + d + '" aria-pressed="' + (d === state.date) + '" aria-label="' + fmtLong(d) + '">' +
        '<small>' + (i === 0 ? 'Today' : fmtDate(d, { weekday: 'short' })) + '</small><strong>' + fmtDate(d, { day: 'numeric' }) + '</strong>' +
        '<small>' + fmtDate(d, { month: 'short' }) + '</small></button>';
    }
    days.innerHTML = html;
    var input = $('[data-date-input]');
    input.min = cfg.today;
    input.max = addDays(cfg.today, cfg.maxDaysAhead);
    if (!state.date) pickDate(cfg.today);
    else loadSlots();
  }

  function pickDate(d) {
    state.date = d;
    state.time = null;
    $$('.bk-day').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.date === d)); });
    var input = $('[data-date-input]');
    if (input.value !== d) input.value = $$('.bk-day').some(function (b) { return b.dataset.date === d; }) ? '' : d;
    loadSlots();
  }

  function loadSlots() {
    var box = $('[data-slots]');
    $('[data-slots-label]').textContent = 'Available times · ' + fmtLong(state.date);
    box.innerHTML = '<p class="bk-muted">Checking availability…</p>';
    syncNext();
    var req = ++slotReq;
    api.slots(state.service, state.duration, state.date).then(function (slots) {
      if (req !== slotReq) return;
      if (!slots.length) {
        box.innerHTML = '<p class="bk-muted">No openings on this day. Try another date, or call <a href="tel:+14037149481">403 714 9481</a>.</p>';
        return;
      }
      box.innerHTML = slots.map(function (t) {
        return '<button type="button" class="bk-slot" data-time="' + t + '" aria-pressed="' + (t === state.time) + '">' + fmtTime(t) + '</button>';
      }).join('');
    }).catch(function () {
      if (req !== slotReq) return;
      box.innerHTML = '<p class="bk-muted">We couldn\'t load times right now. Please call <a href="tel:+14037149481">403 714 9481</a> to book.</p>';
    });
  }

  function renderSummary() {
    var svc = serviceObj();
    var q = quote();
    $('[data-summary]').innerHTML = '<span class="bk-summary-main"><strong>' + esc(svc.name) + '</strong> · ' + state.duration + ' min<br>' +
      fmtLong(state.date) + ' at <strong>' + fmtTime(state.time) + '</strong></span>' +
      '<span class="bk-price">' + (q.pct ? '<s>' + money(q.price) + '</s> ' : '') + '<strong>' + money(q.total) + '</strong>' +
      (q.pct ? '<small>' + q.pct + '% new-client discount</small>' : '<small>Paid at the studio</small>') + '</span>';
  }

  function setFieldErrors(fields) {
    $$('[data-err]').forEach(function (el) {
      var name = el.dataset.err;
      var msg = (fields && fields[name]) || '';
      el.textContent = msg;
      var input = form.elements[name];
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
  }

  function clientValidate(data) {
    var f = {};
    if (!data.name.trim()) f.name = 'Enter your name.';
    if (data.phone.replace(/\D/g, '').length < 7) f.phone = 'Enter a valid phone number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) f.email = 'Enter a valid email address.';
    return f;
  }

  function submit(e) {
    e.preventDefault();
    if ($('[data-submit]').disabled) return; // already sending
    var data = {
      service: state.service, duration: state.duration, date: state.date, time: state.time,
      name: form.elements.name.value, phone: form.elements.phone.value, email: form.elements.email.value,
      notes: form.elements.notes.value, website: form.elements.website.value,
      firstVisit: form.elements.firstVisit.checked,
    };
    var errs = clientValidate(data);
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      form.elements[Object.keys(errs)[0]].focus();
      return;
    }
    var btn = $('[data-submit]');
    btn.disabled = true;
    btn.textContent = 'Booking…';
    api.book(data).then(function (booking) {
      state.booking = booking;
      $('[data-done-ref]').textContent = booking.ref;
      var total = booking.total != null ? booking.total : quote().total;
      $('[data-done-text]').textContent = serviceObj().name + ' (' + state.duration + ' min, ' + money(total) + ') on ' + fmtLong(state.date) + ' at ' + fmtTime(state.time) +
        '. We\'ll see you at 70 Elgin Meadows Way SE.';
      go(4);
      $('[data-step="4"]').focus();
    }).catch(function (err) {
      if (err.status === 409) {
        state.time = null;
        go(2);
        showAlert(err.message);
        return;
      }
      if (err.fields) setFieldErrors(err.fields);
      showAlert(err.message || 'Something went wrong. Please call 403 714 9481 to book.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = 'Confirm booking';
    });
  }

  function downloadIcs() {
    var start = state.date.replace(/-/g, '') + 'T' + state.time.replace(':', '') + '00';
    var endMin = +state.time.slice(0, 2) * 60 + +state.time.slice(3) + state.duration;
    var end = state.date.replace(/-/g, '') + 'T' + String(Math.floor(endMin / 60)).padStart(2, '0') + String(endMin % 60).padStart(2, '0') + '00';
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Massage Fenix//Booking//EN', 'BEGIN:VEVENT',
      'UID:' + state.booking.ref + '@massagecalgary.ca',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;TZID=' + cfg.timezone + ':' + start,
      'DTEND;TZID=' + cfg.timezone + ':' + end,
      'SUMMARY:' + serviceObj().name + ' at Massage Fenix',
      'LOCATION:70 Elgin Meadows Way SE\\, Calgary\\, AB T2Z 0G3',
      'DESCRIPTION:Confirmation ' + state.booking.ref + '. To change your appointment call 403 714 9481.',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'massage-fenix-' + state.booking.ref + '.ics';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function restart() {
    state = { step: 1, service: null, duration: null, date: null, time: null, booking: null };
    form.reset();
    setFieldErrors({});
    $$('input[name="bk-service"]').forEach(function (r) { r.checked = false; });
    $('.bk-durations-wrap').hidden = true;
    syncNext();
    go(1);
  }

  // ---------- Events ----------
  root.addEventListener('change', function (e) {
    if (e.target.name === 'bk-duration') { state.duration = Number(e.target.value); state.time = null; syncNext(); }
    if (e.target.matches('[data-date-input]') && e.target.value) {
      var v = e.target.value;
      if (v >= e.target.min && v <= e.target.max) pickDate(v);
    }
  });
  root.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.matches('[data-next]')) go(state.step + 1);
    else if (t.matches('[data-back]')) go(state.step - 1);
    else if (t.matches('.bk-day')) pickDate(t.dataset.date);
    else if (t.matches('.bk-slot')) {
      state.time = t.dataset.time;
      $$('.bk-slot').forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); });
      syncNext();
    }
    else if (t.matches('[data-ics]')) downloadIcs();
    else if (t.matches('[data-restart]')) restart();
  });
  // Confirm is a plain button, not a form submit: embedded previews often run in frames that
  // block form submission, and a click handler works everywhere. Enter in a field confirms too.
  $('[data-submit]').addEventListener('click', submit);
  form.addEventListener('submit', submit);
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox])')) submit(e);
  });
  form.elements.firstVisit.addEventListener('change', renderSummary);
  form.addEventListener('input', function (e) {
    var err = $('[data-err="' + e.target.name + '"]');
    if (err && err.textContent) { err.textContent = ''; e.target.setAttribute('aria-invalid', 'false'); }
  });

  // ---------- Slide-in booking panel ----------
  // Every "Book" link opens the panel over the current page; "Book this" on a service card
  // also preselects that service. Without JavaScript, #booking falls back to CSS :target.
  function openBooking(serviceId, duration) {
    if (serviceId) {
      if (cfg) { restart(); selectService(serviceId); if (duration) selectDuration(duration); }
      else { pendingService = serviceId; pendingDuration = duration; }
    } else if (state.step === 4) {
      restart();
    }
    if (modal.classList.contains('is-open')) return;
    // Pick up any change to hours or the booking window made in the admin since the page loaded.
    if (cfg) api.config().then(function (c) { cfg.hours = c.hours; cfg.maxDaysAhead = c.maxDaysAhead; cfg.today = c.today; }).catch(function () {});
    lastFocus = document.activeElement;
    modal.classList.remove('is-closing');
    modal.classList.add('is-open');
    document.documentElement.classList.add('bk-locked');
    panel.scrollTop = 0;
    requestAnimationFrame(function () { panel.focus({ preventScroll: true }); });
  }

  function closeBooking() {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.add('is-closing');
    document.documentElement.classList.remove('bk-locked');
    setTimeout(function () { modal.classList.remove('is-open', 'is-closing'); }, 240);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('a[href="#booking"], [data-open-booking], [data-book-service]');
    if (opener) {
      e.preventDefault();
      openBooking(opener.dataset.bookService, Number(opener.dataset.bookDuration) || null);
      return;
    }
    if (e.target.closest('[data-close-booking]')) {
      e.preventDefault();
      closeBooking();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') { closeBooking(); return; }
    if (e.key !== 'Tab') return;
    // Keep keyboard focus inside the panel.
    var focusable = $$('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea, [tabindex="0"]', modal)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  if (location.hash === '#booking') {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* ignore */ }
    openBooking();
  }

  // ---------- Init ----------
  api.config().then(function (c) {
    cfg = c;
    renderServices();
    if (pendingService) selectService(pendingService);
    if (pendingService && pendingDuration) selectDuration(pendingDuration);
    syncNext();
  }).catch(function () {
    $('[data-services]').innerHTML = '<p class="bk-muted">Online booking is unavailable right now. Please call <a href="tel:+14037149481">403 714 9481</a> or email <a href="mailto:info@massagecalgary.ca">info@massagecalgary.ca</a>.</p>';
  });

  // ---------- Demo mock (static preview only) ----------
  function demoApi(conf) {
    function todayLocal() {
      var p = {};
      new Intl.DateTimeFormat('en-CA', { timeZone: conf.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return { date: p.year + '-' + p.month + '-' + p.day, min: +p.hour * 60 + +p.minute };
    }
    var booked = {};
    var delay = function (v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 250); }); };
    return {
      config: function () { return delay(Object.assign({}, conf, { today: todayLocal().date })); },
      slots: function (service, duration, date) {
        var now = todayLocal();
        var h = conf.hours[parseDate(date).getUTCDay()];
        if (!h) return delay([]);
        var toMin = function (s) { return +s.slice(0, 2) * 60 + +s.slice(3); };
        var out = [];
        for (var t = toMin(h[0]); t + duration <= toMin(h[1]); t += conf.slotStepMinutes) {
          if (date === now.date && t < now.min + conf.minNoticeMinutes) continue;
          var seed = (parseDate(date).getUTCDate() * 7 + t / 30) % 5;
          if (seed === 0) continue; // pretend some slots are taken
          var hh = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
          if (booked[date + hh]) continue;
          out.push(hh);
        }
        return delay(out);
      },
      book: function (p) {
        booked[p.date + p.time] = true;
        return delay({ ref: 'DEMO' + Math.random().toString(36).slice(2, 6).toUpperCase() });
      },
    };
  }
})();
