# Massage Fenix website

A redesign of [massagecalgary.ca](https://massagecalgary.ca/) that keeps the original navy-and-gold palette and adds built-in online booking.

## Run it

Requires **Node 22.13+** (for the built-in `node:sqlite`). There are no packages to install.

```sh
ADMIN_PASSWORD=choose-a-strong-password npm start
# site:  http://localhost:3000
# admin: http://localhost:3000/admin/login  (or the "Staff login" link in the site footer)
```

| Environment variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default `3000`). |
| `ADMIN_PASSWORD` | The staff password. Turns on the admin; it's disabled when this is unset. |
| `COOKIE_SECURE` | Set to `1` when the site is served over HTTPS (or use `TRUST_PROXY=1` behind an HTTPS proxy) so the login cookie is marked Secure. |
| `DATA_DIR` | Where the SQLite database is stored (default `./data`). Use a persistent disk in production. |
| `NOTIFY_WEBHOOK_URL` | Optional. Each new booking is POSTed here as JSON with a `text` summary. This works with Slack, or with Zapier or Make to forward bookings by email or SMS. |
| `TRUST_PROXY` | Set to `1` behind a reverse proxy so rate limiting uses the real client IP. |

## How booking works

- Every "Book" button opens a booking panel that slides in over the current page, so visitors never lose their place. "Book this" on a service card opens it with that service already selected. The panel closes with ×, Escape or a click outside it.
- Clients pick a service and session length, then a date and time, then enter their details. They get a confirmation number and an "Add to calendar" file.
- Available times come from the opening hours in `config.js`, minus existing bookings (with a 15-minute turnover buffer) and any blocked time. Two people can't book the same slot.
- Staff sign in at `/admin/login` (linked as "Staff login" in the site footer) with `ADMIN_PASSWORD`. Sign-in lasts 12 hours, and there's a Log out button. Ten wrong passwords in 15 minutes lock login for that address for 15 minutes. Scripts can also call the admin API with HTTP Basic auth.
- The admin page (`/admin`) uses the website's look (glass, light/dark switch) and has three tabs:
  - **Appointments:** upcoming bookings with totals; cancel with one click.
  - **Hours:** the weekly schedule (open/closed and times for each day) and booking rules (start-time interval, break between clients, minimum notice, how far ahead). Saving applies immediately to the booking form and the hours shown on the website, with no restart. "Reset to defaults" goes back to `config.js`.
  - **Time off:** one-tap "Take today off" / "Take tomorrow off", or block any date and time range.
- Prices come from the price list in `config.js`. A service can only be booked for the session lengths that have a price (for example, hot & cold stone is 60 or 90 minutes). Clients who tick "first visit" get the new-client discount (10%). Each booking stores its price and total, and the admin page shows expected revenue.
- The pricing table and service cards on the site show the same prices. Clicking a price opens booking with that massage and length already selected.
- `config.js` holds the default hours and rules (used until hours are saved in the admin page). To change prices, services, buffer, notice period or how far ahead clients can book, edit `config.js`.

## Project layout

- `public/`: the website (`index.html`, `styles.css`, `script.js`, `booking.js`)
- `admin/index.html`: the bookings dashboard, served only after login
- `server.js`: static files plus the booking API, backed by `node:sqlite`
- `config.js`: studio hours, services and booking rules
- `test/`: API tests (`npm test`)
- `public/fonts/`: Lato and Playfair Display served locally (no Google Fonts requests)
- `scripts/build-preview.js`: `npm run preview` writes self-contained previews to `dist/`. They load nothing from the internet and work without JavaScript:
  - `preview-all.html`: one page with tabs for the website, the website in a phone frame, and the admin dashboard
  - `preview.html`: the website with a drawn map instead of Google Maps. With JavaScript, a small in-browser demo server (`scripts/demo-backend.js`) stands in for `server.js`, so demo bookings show up in the admin (Staff login in the footer), and hours and time off changed there apply to the booking form. Demo data is kept in the browser; the admin's Reset demo button clears it. Without JavaScript, a CSS-only version of booking and login still works.
  - `admin-preview.html`: the admin dashboard, sharing the same demo data

## Deploying

Any host that runs a long-lived Node process and has a persistent disk will work, such as Render, Railway, Fly.io or a small VPS. Serve it over HTTPS, because the admin login uses HTTP Basic auth.
