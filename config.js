// Studio settings used by the booking system and price list. Edit these to match how the studio runs.
module.exports = {
  timezone: 'America/Edmonton',

  // Opening hours by weekday (0 = Sunday). Use null for a closed day.
  hours: {
    0: ['09:30', '17:00'],
    1: ['09:00', '20:00'],
    2: ['09:00', '20:00'],
    3: ['09:00', '20:00'],
    4: ['09:00', '20:00'],
    5: ['09:00', '20:00'],
    6: ['09:30', '17:00'],
  },

  slotStepMinutes: 30,    // how often start times are offered
  bufferMinutes: 15,      // gap kept between appointments for turnover
  minNoticeMinutes: 120,  // earliest a same-day booking can start from now
  maxDaysAhead: 60,       // how far ahead clients can book

  currency: 'CAD',

  // Services with price (dollars) per session length in minutes. Only listed lengths can be booked.
  services: [
    { id: 'therapeutic', name: 'Therapeutic massage', prices: { 30: 60, 45: 80, 60: 120, 90: 180 } },
    { id: 'relaxation', name: 'Relaxation massage', prices: { 30: 60, 45: 80, 60: 120, 90: 180 } },
    { id: 'pregnancy', name: 'Pregnancy massage', prices: { 30: 60, 45: 80, 60: 120, 90: 180 } },
    { id: 'deep-tissue', name: 'Deep tissue massage', prices: { 30: 60, 45: 80, 60: 120, 90: 180 } },
    { id: 'sport', name: 'Sport massage', prices: { 30: 60, 45: 80, 60: 120, 90: 180 } },
    { id: 'anti-cellulite', name: 'Anti-cellulite massage', prices: { 30: 60, 45: 80, 60: 120, 90: 180 } },
    { id: 'aromatherapy', name: 'Aromatherapy massage', prices: { 30: 60, 45: 80, 60: 120, 90: 180 } },
    { id: 'cupping', name: 'Cupping (vacuum)', prices: { 30: 60, 45: 80, 60: 120, 90: 180 } },
    { id: 'reflexology', name: 'Reflexology', prices: { 30: 60, 45: 80, 60: 120, 90: 180 } },
    { id: 'stone', name: 'Hot & cold stone', prices: { 60: 140, 90: 200 } },
    { id: 'bamboo', name: 'Bamboo massage', prices: { 30: 60, 60: 120, 90: 180 } },
  ],

  // First session for new clients, any massage.
  newClientDiscountPercent: 10,
};

// Derive the bookable session lengths from the price list.
for (const s of module.exports.services) {
  s.durations = Object.keys(s.prices).map(Number).sort((a, b) => a - b);
}
