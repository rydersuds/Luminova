// Builds dist/preview.html: the whole site in one self-contained file for sharing a look at the design.
// Embedded previewers often block scripts, so booking in the preview is a JavaScript-free demo
// driven by radio buttons and CSS :has(). Nothing is saved, and availability is made up.
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const pub = path.join(__dirname, '..', 'public');
const read = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
const inline = (code) => code.replace(/<\/script/gi, '<\\/script');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Dates & times ----------
const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3);
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0');
const fmtTime = (m) => { const h = Math.floor(m / 60); return ((h % 12) || 12) + ':' + String(m % 60).padStart(2, '0') + ' ' + (h < 12 ? 'am' : 'pm'); };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x; };
const fmt = (date, opts) => date.toLocaleDateString('en-CA', { timeZone: 'UTC', ...opts });

const allDurations = [...new Set(config.services.flatMap((s) => s.durations))].sort((a, b) => a - b);
const minDuration = allDurations[0];

// Next 14 open days, starting tomorrow (so the preview never offers times that have already passed).
const days = [];
for (let i = 1; days.length < 14 && i < 30; i++) {
  const date = addDays(today, i);
  const hours = config.hours[date.getUTCDay()];
  if (!hours) continue;
  const open = toMin(hours[0]);
  const close = toMin(hours[1]);
  const slots = [];
  for (let t = open; t + minDuration <= close; t += config.slotStepMinutes) {
    if ((date.getUTCDate() * 7 + t / 30) % 5 === 0) continue; // pretend some times are taken
    slots.push({ t, tooLongFor: allDurations.filter((d) => t + d > close) });
  }
  days.push({ i: days.length, date, slots });
}

// ---------- Markup ----------
const radio = (name, id, checked, cls = '') => `<input class="d-state${cls ? ' ' + cls : ''}" type="radio" name="${name}" id="${id}"${checked ? ' checked' : ''}>`;
const btn = (forId, cls, text) => `<label class="btn ${cls}" for="${forId}">${text}</label>`;

const money = (n) => '$' + (n % 1 ? n.toFixed(2) : n);
const pct = config.newClientDiscountPercent;
const pairs = config.services.flatMap((s) => s.durations.map((d) => ({ s, d, price: s.prices[d], disc: Math.round(s.prices[d] * (100 - pct)) / 100 })));
const summary = `
  <span class="d-sum">
    ${config.services.map((s) => `<strong class="d-sum-svc d-sum-svc-${s.id}">${esc(s.name)}</strong>`).join('')}
    ${allDurations.map((d) => `<span class="d-sum-dur d-sum-dur-${d}"> · ${d} min</span>`).join('')}<br>
    ${days.map((d) => `<span class="d-sum-day d-sum-day-${d.i}">${fmt(d.date, { weekday: 'long', month: 'long', day: 'numeric' })}</span>`).join('')}
    ${days.map((d) => d.slots.map((s) => `<span class="d-sum-time d-sum-time-${d.i}-${hhmm(s.t)}"> at <strong>${fmtTime(s.t)}</strong></span>`).join('')).join('')}
  </span>
  <span class="bk-price">
    ${pairs.map((x) => `<span class="d-sum-price d-sum-price-${x.s.id}-${x.d}"><strong>${money(x.price)}</strong><small>Paid at the studio</small></span>`).join('')}
    ${pairs.map((x) => `<span class="d-sum-disc d-sum-disc-${x.s.id}-${x.d}"><s>${money(x.price)}</s> <strong>${money(x.disc)}</strong><small>${pct}% new-client discount</small></span>`).join('')}
  </span>`;

const booker = `<div class="booker booker-demo">
          ${[1, 2, 3, 4].map((n) => radio('d-step', `d-step${n}`, n === 1)).join('')}
          ${radio('d-svc', 'd-svc-none', true)}${radio('d-svc', 'd-svc-any', false, 'd-open')}
          <p class="d-note">Preview mode: try the full booking flow. Nothing is saved and the open times are examples.</p>
          <ol class="bk-progress" aria-label="Booking steps">
            <li data-progress="1"><span>1</span>Service</li>
            <li data-progress="2"><span>2</span>Date &amp; time</li>
            <li data-progress="3"><span>3</span>Your details</li>
          </ol>

          <div class="bk-step d-p d-p1">
            <p class="bk-label">Choose a service</p>
            <div class="bk-services">
              ${config.services.map((s) => `<span class="bk-option">${radio('d-svc', `d-svc-${s.id}`, false, 'd-open d-svc-real')}<label for="d-svc-${s.id}">${esc(s.name)}<small>from ${money(Math.min(...Object.values(s.prices)))}</small></label></span>`).join('\n              ')}
            </div>
            <div class="bk-durations-wrap d-durs">
              <p class="bk-label">Session length</p>
              <div class="bk-pills">
                ${allDurations.map((d) => `<span class="bk-option d-dur d-dur-${d}">${radio('d-dur', `d-dur-${d}`)}<label for="d-dur-${d}">${d} min${config.services.filter((s) => s.prices[d]).map((s) => `<small class="d-pp d-pp-${s.id}">${money(s.prices[d])}</small>`).join('')}</label></span>`).join('')}
              </div>
            </div>
            <div class="bk-nav"><span></span>${btn('d-step2', 'btn-gold d-next d-next1', 'Continue')}</div>
          </div>

          <div class="bk-step d-p d-p2">
            <p class="bk-label">Choose a date</p>
            <div class="bk-days">
              ${days.map((d) => `${radio('d-day', `d-day-${d.i}`, d.i === 0)}<label class="bk-day" for="d-day-${d.i}"><small>${fmt(d.date, { weekday: 'short' })}</small><strong>${fmt(d.date, { day: 'numeric' })}</strong><small>${fmt(d.date, { month: 'short' })}</small></label>`).join('')}
            </div>
            <p class="bk-label d-slots-label">Available times</p>
            ${days.map((d) => `<div class="bk-slots d-slots d-slots-${d.i}">${d.slots.map((s) =>
              `${radio(`d-time-${d.i}`, `d-t-${d.i}-${hhmm(s.t)}`)}<label class="bk-slot${s.tooLongFor.map((x) => ` x${x}`).join('')}" for="d-t-${d.i}-${hhmm(s.t)}">${fmtTime(s.t)}</label>`).join('')}</div>`).join('\n            ')}
            <div class="bk-nav">${btn('d-step1', 'btn-text', 'Back')}${btn('d-step3', 'btn-gold d-next d-next2', 'Continue')}</div>
          </div>

          <div class="bk-step d-p d-p3">
            <div class="bk-summary">${summary}</div>
            <div class="bk-fields">
              <label>Full name<input name="name" autocomplete="name" required maxlength="100"></label>
              <label>Phone<input name="phone" type="tel" autocomplete="tel" required pattern="[0-9 ()+.\\-]{7,30}"></label>
              <label class="bk-full">Email<input name="email" type="email" autocomplete="email" required></label>
              <label class="bk-full">Anything we should know? <span class="bk-muted">(optional)</span>
                <textarea name="notes" rows="3" placeholder="Areas of focus, injuries, pregnancy, pressure preference…"></textarea>
              </label>
              <span class="bk-check bk-full"><input type="checkbox" id="d-first"><label for="d-first">This is my first visit to Massage Fenix <em>New clients get ${pct}% off their first session</em></label></span>
            </div>
            <p class="bk-muted bk-policy d-fill-hint">Fill in your name, phone and email to confirm.</p>
            <p class="bk-muted bk-policy">Need to cancel or reschedule? Please call <a href="tel:+14037149481">403 714 9481</a> at least 24 hours ahead.</p>
            <div class="bk-nav">${btn('d-step2', 'btn-text', 'Back')}${btn('d-step4', 'btn-gold d-next d-confirm', 'Confirm booking')}</div>
          </div>

          <div class="bk-step bk-done d-p d-p4">
            <div class="bk-done-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h3>You're booked!</h3>
            <p>${summary}</p>
            <p class="bk-ref">Confirmation <strong>DEMO7K</strong></p>
            <div class="bk-nav bk-nav-center">${btn('d-step1', 'btn-outline-navy', 'Book another')}</div>
          </div>
        </div>`;

// ---------- CSS state rules ----------
const B = '.booker-demo';
const has = (...ids) => ids.map((id) => `:has(#${id}:checked)`).join('');
const rules = [];
const add = (sel, body) => rules.push(`${sel}{${body}}`);

// Steps and progress
[1, 2, 3, 4].forEach((n) => {
  add(`${B}${has(`d-step${n}`)} .d-p${n}`, 'display:block');
  add(`${B}${has(`d-step${n}`)} [data-progress="${n}"]`, 'color:var(--navy)');
  add(`${B}${has(`d-step${n}`)} [data-progress="${n}"] span`, 'background:var(--navy);border-color:var(--navy);color:#fff');
  for (let k = 1; k < n; k++) {
    add(`${B}${has(`d-step${n}`)} [data-progress="${k}"]`, 'color:var(--gold-dark)');
    add(`${B}${has(`d-step${n}`)} [data-progress="${k}"] span`, 'background:var(--gold);border-color:var(--gold);color:#fff');
  }
});
// Durations offered per service; Continue only for a valid pair
config.services.forEach((s) => s.durations.forEach((d) => {
  add(`${B}${has(`d-svc-${s.id}`)} .d-dur-${d}`, 'display:inline-block');
  add(`${B}${has(`d-svc-${s.id}`, `d-dur-${d}`)} .d-next1`, 'opacity:1;pointer-events:auto');
  add(`${B}${has(`d-svc-${s.id}`)} .d-sum-svc-${s.id}`, 'display:inline');
}));
// Prices: per-service price on each length, and the summary total with or without the first-visit discount
config.services.forEach((s) => add(`${B}${has(`d-svc-${s.id}`)} .d-pp-${s.id}`, 'display:block;font-weight:400;font-size:.82rem;color:var(--ink-soft);margin-top:2px'));
pairs.forEach((x) => {
  add(`${B}${has(`d-svc-${x.s.id}`, `d-dur-${x.d}`)}:not(:has(#d-first:checked)) .d-sum-price-${x.s.id}-${x.d}`, 'display:inline');
  add(`${B}${has(`d-svc-${x.s.id}`, `d-dur-${x.d}`, 'd-first')} .d-sum-disc-${x.s.id}-${x.d}`, 'display:inline');
});
allDurations.forEach((d) => {
  add(`${B}${has(`d-dur-${d}`)} .d-sum-dur-${d}`, 'display:inline');
  add(`${B}${has(`d-dur-${d}`)} .bk-slot.x${d}`, 'display:none');
});
// Days, times and summary
days.forEach((d) => {
  add(`${B}${has(`d-day-${d.i}`)} .d-slots-${d.i}`, 'display:grid');
  add(`${B}${has(`d-day-${d.i}`)} .d-sum-day-${d.i}`, 'display:inline');
  add(`${B}${has(`d-day-${d.i}`)}:has([name="d-time-${d.i}"]:checked) .d-next2`, 'opacity:1;pointer-events:auto');
  d.slots.forEach((s) => add(`${B}${has(`d-day-${d.i}`, `d-t-${d.i}-${hhmm(s.t)}`)} .d-sum-time-${d.i}-${hhmm(s.t)}`, 'display:inline'));
});

const css = `
${B},${B} .bk-option,${B} .bk-days,${B} .d-slots{position:relative}
label.service-book{cursor:pointer}
${B} .d-slots-label{margin-top:22px}
${B} .d-state{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
${B} .d-p,${B} .d-slots,${B} .d-durs,${B} .d-dur,${B} .d-pp,${B} [class*="d-sum-"]{display:none}
${B} .bk-option label small:not(.d-pp){display:block;font-weight:400;font-size:.82rem;color:var(--ink-soft);margin-top:2px}
${B} .bk-pills .bk-option label{text-align:center}
${B} .bk-price small{display:block}
${B} .d-p4 .bk-price{display:block;text-align:center;margin-top:10px}
${B} .bk-check label{display:block;font-weight:700;color:var(--navy);cursor:pointer}
${B} .bk-check{display:flex}
${B}:has(.d-svc-real:checked) .d-durs{display:block}
${B} .d-next{opacity:.45;pointer-events:none}
${B}:not(:has(.d-p3 :invalid)) .d-confirm{opacity:1;pointer-events:auto}
${B}:not(:has(.d-p3 :invalid)) .d-fill-hint{display:none}
${B} .d-note{font-size:.85rem;color:var(--gold-dark);background:var(--gold-soft);padding:8px 14px;border-radius:var(--radius);margin:0 0 20px}
${B} .bk-option label{display:block;padding:14px 16px;border:1.5px solid var(--line);border-radius:var(--radius);font-weight:700;color:var(--navy);cursor:pointer;transition:border-color .15s,background .15s}
${B} .bk-pills .bk-option label{padding:10px 22px;border-radius:999px}
${B} .bk-option label:hover{border-color:var(--navy-3)}
${B} .d-state:checked+label.bk-day,${B} .bk-option .d-state:checked+label{border-color:var(--gold);background:var(--gold-soft)}
${B} .d-state:checked+label.bk-slot{background:var(--navy);border-color:var(--navy);color:#fff}
${B} .d-state:focus-visible+label{outline:3px solid var(--gold);outline-offset:2px}
${B} label.bk-slot,${B} label.bk-day{text-align:center;display:block}
${B} .bk-days label.bk-day{display:inline-block}
${B} label.btn{user-select:none}
${B} .bk-fields input:user-invalid{border-color:#b44}
${B} .d-p4 .d-sum{display:inline}
${B} .bk-summary .d-sum,${B} .d-p4 .d-sum{display:inline}
${rules.join('\n')}
/* Panel opens while any opener radio (generic or a service) is checked; closing checks d-svc-none. */
body:has(.d-open:checked) .bk-modal{display:block}
html:has(.d-open:checked){overflow:hidden}
html:has(.d-open:checked) .mobile-book{display:none}
${B}:has(#d-svc-any:checked) .d-p{display:none!important}
${B}:has(#d-svc-any:checked) .d-p1{display:block!important}
${B}:has(#d-svc-any:checked) [data-progress]{color:#9aa3b5!important}
${B}:has(#d-svc-any:checked) [data-progress] span{background:none!important;border-color:currentColor!important;color:inherit!important}
${B}:has(#d-svc-any:checked) [data-progress="1"]{color:var(--navy)!important}
${B}:has(#d-svc-any:checked) [data-progress="1"] span{background:var(--navy)!important;border-color:var(--navy)!important;color:#fff!important}
label.bk-backdrop,label.bk-close{cursor:pointer}
.price-table td label.price-link{display:inline-block;min-width:64px;padding:5px 10px;border-radius:999px;border:1.5px solid transparent;font-family:var(--serif);font-weight:700;font-size:1.08rem;color:var(--navy);cursor:pointer;transition:all .15s}
.price-table td label.price-link:hover{border-color:var(--gold);background:var(--gold-soft)}
@media (max-width:640px){.price-table td label.price-link{min-width:0;padding:4px 5px;font-size:.95rem}}
.nav label{color:var(--navy);font-weight:700;font-size:.98rem;padding:6px 0;cursor:pointer}
@media (max-width:820px){.nav label{padding:14px 0;border-bottom:1px solid var(--line);font-size:1.05rem}}
`;

// ---------- Shared helpers ----------
// Fonts are embedded as data URIs so the previews load nothing from the internet.
const fontDir = path.join(pub, 'fonts');
const fontCss = fs.readFileSync(path.join(fontDir, 'fonts.css'), 'utf8').replace(/url\('([\w.-]+\.woff2)'\)/g, (m, f) =>
  `url(data:font/woff2;base64,${fs.readFileSync(path.join(fontDir, f)).toString('base64')})`);
const money2 = (n) => '$' + (n % 1 ? n.toFixed(2) : n);
const dist = path.join(__dirname, '..', 'dist');
function write(name, content) {
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, name), content);
  console.log('Wrote', path.join('dist', name), `(${Math.round(content.length / 1024)} KB)`);
}
function assertOffline(name, content) {
  const external = content.match(/(?:href|src)="https?:\/\/[^"]+"/g);
  if (external) throw new Error(`${name} still links outside the preview: ${external.join(', ')}`);
}

// Stylised map for the preview, in place of the embedded Google map.
const mapSvg = `<div class="map map-static" role="img" aria-label="Map: Massage Fenix at 70 Elgin Meadows Way SE, McKenzie Towne, Calgary">
          <svg viewBox="0 0 600 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="600" height="420" fill="#efe9dd"/>
            <path d="M0 300 C120 280 200 330 330 300 S520 250 600 270 V420 H0Z" fill="#dfe6d6"/>
            <circle cx="470" cy="110" r="70" fill="#dfe6d6"/>
            <g fill="none" stroke="#fff" stroke-linecap="round">
              <path d="M-10 190 H610" stroke-width="22"/>
              <path d="M300 -10 V430" stroke-width="18"/>
              <path d="M60 -10 C90 120 110 260 80 430" stroke-width="12"/>
              <path d="M520 -10 C500 150 540 280 520 430" stroke-width="12"/>
              <path d="M-10 90 C150 110 250 70 610 60" stroke-width="10"/>
              <path d="M-10 330 C200 350 380 300 610 350" stroke-width="10"/>
              <path d="M300 190 C340 240 400 250 440 300" stroke-width="9"/>
            </g>
            <g font-family="Lato, sans-serif" font-size="13" fill="#8a8f99" letter-spacing="1.5">
              <text x="20" y="182">52 ST SE</text>
              <text x="310" y="30" transform="rotate(90 310 30)">ELGIN MEADOWS WAY SE</text>
              <text x="395" y="115" fill="#7d9270">ELGIN PARK</text>
            </g>
            <g transform="translate(345 232)">
              <ellipse cx="0" cy="36" rx="14" ry="5" fill="rgba(0,0,0,.18)"/>
              <path d="M0 36 C-14 16 -22 6 -22 -6 A22 22 0 0 1 22 -6 C22 6 14 16 0 36Z" fill="#1b2a45"/>
              <circle cx="0" cy="-6" r="8" fill="#c9a55c"/>
            </g>
          </svg>
          <div class="map-label"><strong>Massage Fenix</strong><span>70 Elgin Meadows Way SE, Calgary</span></div>
        </div>`;
const mapCss = `.map-static{position:relative;min-height:380px}
.map-static svg{position:absolute;inset:0;width:100%;height:100%}
.map-label{position:absolute;left:16px;bottom:16px;background:#fff;border-radius:8px;padding:10px 14px;box-shadow:0 10px 24px -14px rgba(21,33,57,.5);border-left:3px solid var(--gold)}
.map-label strong{display:block;font-family:var(--serif);color:var(--navy)}
.map-label span{font-size:.85rem;color:var(--ink-soft)}`;

// ---------- Website preview ----------
let html = read('index.html');
const start = html.indexOf('<div class="booker" data-booker>');
const endMarker = '</noscript>';
const end = html.indexOf('</div>', html.indexOf(endMarker)) + '</div>'.length;
if (start < 0 || end < start) throw new Error('Booking widget markup not found in index.html');
html = html.slice(0, start) + booker + html.slice(end);

html = html
  .replace('<link rel="stylesheet" href="fonts/fonts.css">', () => `<style>\n${fontCss}\n</style>`)
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}\n${css}\n${mapCss}</style>`)
  .replace('<script src="script.js"></script>', () => `<script>\n${inline(read('script.js'))}\n</script>`)
  .replace('<script src="booking.js"></script>', '')
  // Map and directions point at Google; the preview shows a drawn map instead.
  .replace(/<div class="map">[\s\S]*?<\/div>/, () => mapSvg)
  .replace(/\s*<a class="btn btn-outline-navy" href="https:\/\/www\.google\.com\/maps\/dir\/[^"]*">Get directions<\/a>/, '')
  // Links become labels for the demo's radio buttons, so the panel opens and closes without JavaScript.
  // "Book this" opens the panel with that service selected.
  .replace(/<a class="service-book" href="#booking" data-book-service="([\w-]+)">Book this<\/a>/g, '<label class="service-book" for="d-svc-$1">Book this</label>')
  // Prices in the table open the panel with that service selected.
  .replace(/<a href="#booking" data-book-service="([\w-]+)" data-book-duration="\d+"([^>]*)>([^<]*)<\/a>/g, '<label class="price-link" for="d-svc-$1"$2>$3</label>')
  .replace(/<a ([^>]*?)href="#booking"([^>]*)>([\s\S]*?)<\/a>/g, '<label $1for="d-svc-any"$2>$3</label>')
  .replace(/<a ([^>]*?)href="#" data-close-booking([^>]*)>([\s\S]*?)<\/a>/g, '<label $1for="d-svc-none"$2>$3</label>');
if (/href="#booking"|data-close-booking/.test(html)) throw new Error('Unconverted booking link left in preview');
assertOffline('preview.html', html);
write('preview.html', html);

// ---------- Admin dashboard preview (sample bookings, no server) ----------
const sample = [
  [1, '09:30', 'therapeutic', 60, 'Alex Morgan', false, 'Tight shoulders from desk work'],
  [1, '11:00', 'deep-tissue', 90, 'Jordan Lee', false, ''],
  [1, '14:00', 'pregnancy', 60, 'Priya Shah', true, '28 weeks, prefers side-lying'],
  [1, '17:30', 'sport', 45, 'Marcus Chen', false, 'Hamstring after marathon', 'cancelled'],
  [2, '10:00', 'stone', 90, 'Dana Whitfield', true, ''],
  [2, '13:30', 'reflexology', 30, 'Sam Patel', false, ''],
  [2, '18:00', 'cupping', 60, 'Riley Novak', false, 'Lower back'],
  [3, '09:30', 'bamboo', 60, 'Casey Brooks', false, ''],
  [3, '12:00', 'aromatherapy', 90, 'Taylor Singh', true, 'Lavender please'],
];
const svcById = Object.fromEntries(config.services.map((x) => [x.id, x]));
const dayStr = (n) => addDays(today, n).toISOString().slice(0, 10);
const fmtDay = (n) => fmt(addDays(today, n), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const rowsByDay = {};
let active = 0, hoursBooked = 0, revenue = 0;
sample.forEach(([d, time, id, dur, name, first, notes, status = 'confirmed'], i) => {
  const x = svcById[id];
  const total = Math.round(x.prices[dur] * (first ? 100 - pct : 100)) / 100;
  if (status === 'confirmed') { active++; hoursBooked += dur / 60; revenue += total; }
  const startM = toMin(time);
  const email = name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com';
  const ref = 'S' + String(4729 + i * 37).slice(-4) + 'K';
  (rowsByDay[d] ||= []).push(`
              <tr class="${status === 'cancelled' ? 'cancelled' : ''}">
                <td><strong>${fmtTime(startM)}</strong><small>to ${fmtTime(startM + dur)}</small></td>
                <td>${esc(name)}<small><a href="tel:4035550${100 + i}">403-555-0${100 + i}</a></small><small><a href="mailto:${email}">${email}</a></small></td>
                <td>${esc(x.name)}<small>${dur} min · <span class="ref">${ref}</span></small><small><strong>${money2(total)}</strong>${first ? ' <span class="badge">First visit −10%</span>' : ''}</small></td>
                <td>${esc(notes) || '<small>—</small>'}</td>
                <td>${status === 'confirmed'
    ? `<input type="checkbox" id="cx-${i}" class="cx" hidden><label class="danger btnlike" for="cx-${i}"><span class="c-yes">Cancel</span><span class="c-undo">Undo</span></label>`
    : '<small>Cancelled</small>'}</td>
              </tr>`);
});
const list = Object.entries(rowsByDay).map(([d, rows]) => `
          <div class="day"><h3>${fmtDay(+d)}</h3><div class="table-wrap"><table>
            <thead><tr><th>Time</th><th>Client</th><th>Service</th><th>Notes</th><th></th></tr></thead>
            <tbody>${rows.join('')}</tbody>
          </table></div></div>`).join('');
const blocksHtml = `<thead><tr><th>Date</th><th>Time</th><th>Reason</th><th></th></tr></thead><tbody>
  <tr><td>${fmtDay(2)}</td><td>12:00 pm – 1:00 pm</td><td>Lunch</td><td><button class="danger" type="button">Remove</button></td></tr>
  <tr><td>${fmtDay(6)}</td><td>All day</td><td>Closed for training</td><td><button class="danger" type="button">Remove</button></td></tr></tbody>`;

let admin = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8');
admin = admin
  .replace('<link rel="stylesheet" href="/fonts/fonts.css">', () => `<style>\n${fontCss}\n</style>`)
  .replace(/<script>[\s\S]*<\/script>/, '')
  .replace(/\s*<a href="\/">View site<\/a>/, '')
  .replace('<main class="wrap">', `<main class="wrap">
    <p class="preview-note">Preview with sample bookings. On the live site this page is password-protected and shows real bookings as they come in.</p>`)
  .replace('<input type="date" id="from">', `<input type="date" id="from" value="${dayStr(0)}">`)
  .replace('<input type="date" id="to">', `<input type="date" id="to" value="${dayStr(30)}">`)
  .replace('<div class="stats" id="stats"></div>', () => `<div class="stats" id="stats"><span class="stat"><strong>${active}</strong>appointments</span><span class="stat"><strong>${hoursBooked}</strong>hours booked</span><span class="stat"><strong>${money2(revenue)}</strong>expected</span></div>`)
  .replace('<div id="list"><p class="empty">Loading…</p></div>', () => `<div id="list">${list}</div>`)
  .replace('<form class="toolbar" id="block-form">', '<div class="toolbar" id="block-form">')
  .replace(/(<button type="submit">Add block<\/button>\s*)<\/form>/, '<button type="button">Add block</button>\n      </div>')
  .replace('name="date" required>', `name="date" required value="${dayStr(0)}">`)
  .replace('<table id="blocks"></table>', () => `<table id="blocks">${blocksHtml}</table>`)
  .replace('</style>', `  .preview-note { background: var(--gold-soft); color: var(--gold-dark); border-radius: 8px; padding: 10px 14px; margin: 0; font-size: .9rem; }
    .btnlike { display: inline-block; border: 1.5px solid #d9b3b3; border-radius: 4px; padding: 5px 10px; font-size: .85rem; font-weight: 700; cursor: pointer; }
    .btnlike .c-undo { display: none; }
    tr:has(.cx:checked) td { color: #9aa3b5; text-decoration: line-through; }
    tr:has(.cx:checked) td:last-child { text-decoration: none; }
    tr:has(.cx:checked) .c-yes { display: none; }
    tr:has(.cx:checked) .c-undo { display: inline; }
  </style>`);
if (/<script|id="list"><p class="empty">/.test(admin)) throw new Error('Admin preview still depends on the server');
assertOffline('admin-preview.html', admin);
write('admin-preview.html', admin);

// ---------- All-in-one preview: tabs for desktop, phone and admin ----------
const srcdoc = (doc) => doc.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const hub = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Massage Fenix — Preview</title>
<style>
${fontCss}
:root { --navy: #1b2a45; --navy-deep: #152139; --gold: #c9a55c; --gold-soft: #f5eddc; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { font: 15px/1.4 Lato, system-ui, sans-serif; background: #e9e5dc; color: var(--navy); display: flex; flex-direction: column; }
.tabs-state { position: absolute; opacity: 0; pointer-events: none; }
header { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px; padding: 10px 16px; background: var(--navy-deep); border-bottom: 3px solid var(--gold); }
h1 { margin: 0; font: 700 1.1rem "Playfair Display", Georgia, serif; color: #fff; margin-right: auto; }
h1 em { color: var(--gold); }
nav { display: flex; gap: 6px; flex-wrap: wrap; }
nav label { padding: 7px 14px; border-radius: 999px; color: #cdd5e2; font-weight: 700; font-size: .85rem; cursor: pointer; border: 1.5px solid rgba(255,255,255,.2); }
nav label:hover { color: #fff; border-color: rgba(255,255,255,.5); }
#t-desk:checked ~ header [for="t-desk"], #t-phone:checked ~ header [for="t-phone"], #t-admin:checked ~ header [for="t-admin"] { background: var(--gold); border-color: var(--gold); color: #fff; }
#t-desk:focus-visible ~ header [for="t-desk"], #t-phone:focus-visible ~ header [for="t-phone"], #t-admin:focus-visible ~ header [for="t-admin"] { outline: 2px solid #fff; outline-offset: 2px; }
.stage { flex: 1; min-height: 0; display: none; }
#t-desk:checked ~ .s-desk, #t-admin:checked ~ .s-admin { display: block; }
#t-phone:checked ~ .s-phone { display: flex; }
.stage iframe { border: 0; width: 100%; height: 100%; display: block; background: #fff; }
.s-phone { justify-content: center; align-items: flex-start; overflow: auto; padding: 20px 12px; }
.phone { flex: none; width: 406px; max-width: 100%; height: 844px; padding: 8px; border-radius: 44px; background: #10182a; box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); }
.phone iframe { border-radius: 36px; width: 100%; height: 100%; }
.hint { color: #aab4c6; font-size: .8rem; width: 100%; margin: 0; }
@media (min-width: 900px) { .hint { width: auto; } }
</style>
</head>
<body>
<input class="tabs-state" type="radio" name="tab" id="t-desk" checked>
<input class="tabs-state" type="radio" name="tab" id="t-phone">
<input class="tabs-state" type="radio" name="tab" id="t-admin">
<header>
  <h1>Massage <em>Fenix</em> · Preview</h1>
  <nav aria-label="Preview">
    <label for="t-desk">Website</label>
    <label for="t-phone">Phone</label>
    <label for="t-admin">Admin dashboard</label>
  </nav>
  <p class="hint">Everything runs inside this page. Bookings here are a demo and aren't saved.</p>
</header>
<section class="stage s-desk"><iframe title="Website preview" srcdoc="${srcdoc(html)}"></iframe></section>
<section class="stage s-phone"><div class="phone"><iframe title="Website on a phone" srcdoc="${srcdoc(html)}"></iframe></div></section>
<section class="stage s-admin"><iframe title="Admin dashboard preview" srcdoc="${srcdoc(admin)}"></iframe></section>
</body>
</html>
`;
write('preview-all.html', hub);
