// Builds dist/preview.html: the whole site in one file, with booking running in demo mode
// (no server needed). Handy for sharing a quick look at the design.
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const pub = path.join(__dirname, '..', 'public');
const read = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
const inline = (code) => code.replace(/<\/script/gi, '<\\/script');

let html = read('index.html')
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}\n</style>`)
  .replace('<script src="script.js"></script>', () => `<script>\n${inline(read('script.js'))}\n</script>`)
  .replace('<script src="booking.js"></script>', () =>
    `<script>window.BOOKING_DEMO = ${inline(JSON.stringify(config))};</script>\n<script>\n${inline(read('booking.js'))}\n</script>`);

const out = path.join(__dirname, '..', 'dist', 'preview.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('Wrote', path.relative(process.cwd(), out));
