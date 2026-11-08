// Home page copy. Fields: HERO.label (mono figure label), HERO.title (headline lines),
// HERO.place, HERO.lede (optional). QUOTES rotate under the headline. PATHS: [link, title, text].
export const HERO = {
  label: 'Fig. 01 · Quatlas 012',
  title: ['Designed on paper.', 'Proven in the air.'],
  place: 'Quatlas Aeromodelling, Ramaiah Institute of Technology',
};

// The home stats strip's running totals, shown as "25+" and "50+". Update them here as they grow.
export const COUNTS = { competitions: 25, members: 50 };
// The result shown last in that strip: value (big), label, note (small, in red).
export const HIGHLIGHT = { value: '5th', label: 'Place · SAE Competition', note: '2019' };

export const QUOTES = [
  'Designing, building and flying since 2015',
  'A new cargo aircraft every season',
  'From a blank sheet to the flight line',
  'Built by students from every branch',
];

export const PATHS = [
  ['/team', 'Our team', 'Meet the core team and the six subteams behind the aircraft.'],
  ['/support', 'Official supporters', 'Sponsor us with parts, money or services, and put your company in front of students, faculty and industry.'],
  ['/support#crowdfunding', 'Crowdfunding', 'Chip in any amount over UPI. It goes into materials, parts and travel to competitions.'],
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
