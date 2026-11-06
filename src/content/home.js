// Home page copy. Fields: HERO.label (mono figure label), HERO.title (headline lines),
// HERO.place, HERO.lede (optional). QUOTES rotate under the headline. PATHS: [link, title, text].
export const HERO = {
  label: 'Fig. 01 — Quatlas 012',
  title: ['Designed on paper.', 'Proven in the air.'],
  place: 'Quatlas Aeromodelling, Ramaiah Institute of Technology',
};

export const QUOTES = [
  'Pioneering the skies with precision and passion',
  'Where innovation takes flight',
  'Charting new horizons in aerospace excellence',
  'Innovating the blueprint of tomorrow’s aviation',
];

export const PATHS = [
  ['/team', 'Our Team', 'Embark on an exciting career journey with Quatlas today! Exploring the endless skies, one propeller at a time.'],
  ['/support', 'Official Supporters', 'Join us in pioneering the future of aerospace modeling. Sponsor our project and gain access to unique opportunities and advanced technological insights.'],
  ['/support#crowdfunding', 'Crowd Funding', 'Support our mission to innovate and create new possibilities in aerospace modeling. Your contribution will help us push the boundaries of technology and design, shaping the future of the industry.'],
];

// Logos in the Home supporters strip: [image name in assets-src, alt text].
export const LOGOS = [
  ['ramaiah', 'Ramaiah Institute of Technology'],
  ['smart', 'Smart Links Technologies'],
  ['sps01', 'Supporter logo'],
  ['dhd', 'Supporter logo'],
];

// The photo wall on the home page: columns drifting in opposite directions. photos: names from
// src/content/images.json (assets-src/), in the order they're dealt across the columns.
export const WALL = {
  title: 'Off the drawing board',
  text: 'Build nights in the workshop, flight days on the field, and the events in between.',
  photos: [
    'event-chennai-planes', 'event-field-1', 'event-workshop', 'quatlas-05', 'event-pradarshana-1', 'event-chennai-pilot',
    'Copy_of_DSC_5785', 'event-orientation', 'event-field-2', 'Picture62k18', 'event-pradarshana-2', 'event-team-seated',
    'gg03', 'Picture22k19', 'gg05',
  ],
};
