# Massage Fenix website

A redesign of [massagecalgary.ca](https://massagecalgary.ca/) that keeps the original navy-and-gold palette and adds built-in online booking.

## Run it

Requires **Node 22.5+**. There are no packages to install.

```sh
ADMIN_PASSWORD=choose-a-strong-password npm start
# site:  http://localhost:3000
# admin: http://localhost:3000/admin   (any username + ADMIN_PASSWORD)
```

| Environment variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default `3000`). |
| `ADMIN_PASSWORD` | Turns on `/admin`. The admin page is disabled when this is unset. |
| `DATA_DIR` | Where the SQLite database is stored (default `./data`). Use a persistent disk in production. |
| `NOTIFY_WEBHOOK_URL` | Optional. Each new booking is POSTed here as JSON with a `text` summary. This works with Slack, or with Zapier or Make to forward bookings by email or SMS. |
| `TRUST_PROXY` | Set to `1` behind a reverse proxy so rate limiting uses the real client IP. |

## How booking works

- Clients pick a service and session length, then a date and time, then enter their details. They get a confirmation number and an "Add to calendar" file.
- Available times come from the opening hours in `config.js`, minus existing bookings (with a 15-minute turnover buffer) and any blocked time. Two people can't book the same slot.
- In the admin page (`/admin`) the owner can see upcoming appointments, cancel them, and block off time for holidays, breaks or phone bookings.
- To change hours, services, session lengths, buffer, notice period or how far ahead clients can book, edit `config.js`.

## Project layout

- `public/`: the website (`index.html`, `styles.css`, `script.js`, `booking.js`)
- `admin/index.html`: the bookings dashboard, served only after login
- `server.js`: static files plus the booking API, backed by `node:sqlite`
- `config.js`: studio hours, services and booking rules
- `test/`: API tests (`npm test`)
- `scripts/build-preview.js`: `npm run preview` writes `dist/preview.html`, a single-file copy of the site with booking in demo mode, for sharing a look at the design

## Deploying

Any host that runs a long-lived Node process and has a persistent disk will work, such as Render, Railway, Fly.io or a small VPS. Serve it over HTTPS, because the admin login uses HTTP Basic auth.
