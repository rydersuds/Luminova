// Studio settings used by the booking system. Edit these to match how the studio runs.
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

  // Session lengths (minutes) offered for each service.
  services: [
    { id: 'therapeutic', name: 'Therapeutic massage', durations: [60, 90] },
    { id: 'deep-tissue', name: 'Deep tissue', durations: [60, 90] },
    { id: 'sports', name: 'Sports & rehabilitation', durations: [60, 90] },
    { id: 'swedish', name: 'Swedish & relaxation', durations: [60, 90] },
    { id: 'stone', name: 'Hot & cold stone', durations: [60, 90] },
    { id: 'prenatal', name: 'Prenatal & postnatal', durations: [60, 90] },
    { id: 'bamboo', name: 'Bamboo massage', durations: [60, 90] },
    { id: 'reflexology', name: 'Reflexology', durations: [30, 60] },
    { id: 'cupping', name: 'Cupping (vacuum)', durations: [30, 60] },
    { id: 'tigers-point', name: "Tiger's point", durations: [30, 60] },
  ],
};
