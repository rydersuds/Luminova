(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  var mobileBook = document.querySelector('.mobile-book');
  var hero = document.querySelector('.hero');
  var book = document.getElementById('book');

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
  var weekend = day === 0 || day === 6;
  var todayEl = document.querySelector('[data-today-hours]');
  if (todayEl) todayEl.textContent = weekend ? '9:30 am – 5:00 pm' : '9:00 am – 8:00 pm';
  document.querySelectorAll('.hours tr').forEach(function (row) {
    if (row.dataset.days.split(',').indexOf(String(day)) !== -1) row.classList.add('is-today');
  });

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
