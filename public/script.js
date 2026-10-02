(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  var mobileBook = document.querySelector('.mobile-book');
  var hero = document.querySelector('.hero');
  var book = document.getElementById('book');

  // Dark mode switch: the checkbox drives the CSS; remember the choice.
  var root = document.documentElement;
  var themeBox = document.getElementById('theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var systemDark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function savedTheme() { try { return localStorage.getItem('theme'); } catch (e) { return null; } }
  function syncThemeMeta() { if (themeMeta) themeMeta.content = themeBox.checked ? '#0d1524' : '#1b2a45'; }
  if (themeBox) {
    themeBox.checked = root.dataset.theme === 'dark';
    delete root.dataset.theme; // from here on the checkbox is the single source of truth
    syncThemeMeta();
    themeBox.addEventListener('change', function () {
      try { localStorage.setItem('theme', themeBox.checked ? 'dark' : 'light'); } catch (e) { /* ignore */ }
      syncThemeMeta();
    });
    // Follow the system setting until the visitor picks one.
    if (systemDark && systemDark.addEventListener) {
      systemDark.addEventListener('change', function (e) {
        if (!savedTheme()) { themeBox.checked = e.matches; syncThemeMeta(); }
      });
    }
  }

  // Mobile menu
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  // In-page links: scroll directly so they also work inside embedded/sandboxed previews.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2 || a.getAttribute('href') === '#booking') return;
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { history.replaceState(null, '', a.getAttribute('href')); } catch (err) { /* sandboxed */ }
  });

  // Header border + sticky mobile booking button
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    if (mobileBook) {
      var r = book.getBoundingClientRect();
      var inBook = r.top < window.innerHeight && r.bottom > 0;
      mobileBook.classList.toggle('is-shown', window.scrollY > hero.offsetHeight * 0.7 && !inBook);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Service filters
  var chips = document.querySelectorAll('.chip');
  var services = document.querySelectorAll('.service');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.dataset.filter;
      chips.forEach(function (c) {
        var active = c === chip;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-selected', String(active));
      });
      services.forEach(function (s) {
        s.classList.toggle('is-hidden', f !== 'all' && s.dataset.cat !== f);
      });
    });
  });

  // Today's hours (Calgary time)
  var day;
  try {
    var wd = new Intl.DateTimeFormat('en-CA', { weekday: 'short', timeZone: 'America/Edmonton' }).format(new Date());
    day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  } catch (e) { day = new Date().getDay(); }
  var todayEl = document.querySelector('[data-today-hours]');
  var hoursBody = document.querySelector('.hours tbody');
  function fmt12(hhmm) {
    var h = +hhmm.slice(0, 2), m = hhmm.slice(3);
    return ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'am' : 'pm');
  }
  function markToday() {
    document.querySelectorAll('.hours tr').forEach(function (row) {
      row.classList.toggle('is-today', row.dataset.days.split(',').indexOf(String(day)) !== -1);
    });
  }
  // Rebuild the hours table and "Open today" from the hours saved in the admin page.
  function showHours(hours) {
    var names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var order = [1, 2, 3, 4, 5, 6, 0];
    var label = function (d) { return hours[d] ? fmt12(hours[d][0]) + ' – ' + fmt12(hours[d][1]) : 'Closed'; };
    var groups = [];
    order.forEach(function (d) {
      var last = groups[groups.length - 1];
      if (last && label(last.days[last.days.length - 1]) === label(d)) last.days.push(d);
      else groups.push({ days: [d] });
    });
    hoursBody.innerHTML = groups.map(function (g) {
      var first = names[g.days[0]], lastName = names[g.days[g.days.length - 1]];
      var title = g.days.length > 1 ? first + ' – ' + lastName : first;
      return '<tr data-days="' + g.days.join(',') + '"><th scope="row">' + title + '</th><td>' + label(g.days[0]) + '</td></tr>';
    }).join('');
    if (todayEl) {
      todayEl.textContent = label(day);
      var card = todayEl.closest('.hero-card');
      if (card) card.classList.toggle('is-closed', !hours[day]);
      var lbl = card && card.querySelector('.hero-card-label');
      if (lbl) lbl.textContent = hours[day] ? 'Open today' : 'Closed today';
    }
    markToday();
  }
  markToday();
  if (hoursBody && window.STUDIO_HOURS) showHours(window.STUDIO_HOURS); // offline preview: built-in hours first
  if (hoursBody && window.fetch && (window.FenixDemo || location.protocol !== 'file:')) {
    fetch('/api/config').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) { if (c && c.hours) showHours(c.hours); })
      .catch(function () { /* keep the built-in hours */ });
  }

  // Footer year
  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  // Scroll reveal
  var targets = document.querySelectorAll('.section-head, .service, .about-grid > *, .contact-grid > *, .pricing-cta');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (t) { t.classList.add('reveal'); io.observe(t); });
  }
})();
