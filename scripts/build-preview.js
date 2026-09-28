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

const summary = `
  <span class="d-sum">
    ${config.services.map((s) => `<strong class="d-sum-svc d-sum-svc-${s.id}">${esc(s.name)}</strong>`).join('')}
    ${allDurations.map((d) => `<span class="d-sum-dur d-sum-dur-${d}"> · ${d} min</span>`).join('')}<br>
    ${days.map((d) => `<span class="d-sum-day d-sum-day-${d.i}">${fmt(d.date, { weekday: 'long', month: 'long', day: 'numeric' })}</span>`).join('')}
    ${days.map((d) => d.slots.map((s) => `<span class="d-sum-time d-sum-time-${d.i}-${hhmm(s.t)}"> at <strong>${fmtTime(s.t)}</strong></span>`).join('')).join('')}
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
              ${config.services.map((s) => `<span class="bk-option">${radio('d-svc', `d-svc-${s.id}`, false, 'd-open d-svc-real')}<label for="d-svc-${s.id}">${esc(s.name)}</label></span>`).join('\n              ')}
            </div>
            <div class="bk-durations-wrap d-durs">
              <p class="bk-label">Session length</p>
              <div class="bk-pills">
                ${allDurations.map((d) => `<span class="bk-option d-dur d-dur-${d}">${radio('d-dur', `d-dur-${d}`)}<label for="d-dur-${d}">${d} min</label></span>`).join('')}
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
${B} .d-p,${B} .d-slots,${B} .d-durs,${B} .d-dur,${B} [class*="d-sum-"]{display:none}
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
.nav label{color:var(--navy);font-weight:700;font-size:.98rem;padding:6px 0;cursor:pointer}
@media (max-width:820px){.nav label{padding:14px 0;border-bottom:1px solid var(--line);font-size:1.05rem}}
`;

// ---------- Assemble ----------
let html = read('index.html');
const start = html.indexOf('<div class="booker" data-booker>');
const endMarker = '</noscript>';
const end = html.indexOf('</div>', html.indexOf(endMarker)) + '</div>'.length;
if (start < 0 || end < start) throw new Error('Booking widget markup not found in index.html');
html = html.slice(0, start) + booker + html.slice(end);

html = html
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}\n${css}</style>`)
  .replace('<script src="script.js"></script>', () => `<script>\n${inline(read('script.js'))}\n</script>`)
  .replace('<script src="booking.js"></script>', '')
  // Links become labels for the demo's radio buttons, so the panel opens and closes without JavaScript.
  // "Book this" opens the panel with that service selected.
  .replace(/<a class="service-book" href="#booking" data-book-service="([\w-]+)">Book this<\/a>/g, '<label class="service-book" for="d-svc-$1">Book this</label>')
  .replace(/<a ([^>]*?)href="#booking"([^>]*)>([\s\S]*?)<\/a>/g, '<label $1for="d-svc-any"$2>$3</label>')
  .replace(/<a ([^>]*?)href="#" data-close-booking([^>]*)>([\s\S]*?)<\/a>/g, '<label $1for="d-svc-none"$2>$3</label>');
if (/href="#booking"|data-close-booking/.test(html)) throw new Error('Unconverted booking link left in preview');

const out = path.join(__dirname, '..', 'dist', 'preview.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Wrote', path.relative(process.cwd(), out), `(${Math.round(html.length / 1024)} KB)`);
