// Upcoming events. Edit this list to add one: date is 'YYYY-MM-DD' or null while it is not announced.
// Past competitions come from achievements.js, so they never need entering twice.
export const UPCOMING = [
  {
    title: 'Recruitment drive', date: null, place: 'Ramaiah Institute of Technology',
    text: 'Applications open for first and second years across every subteam. Register, take the test, meet the team.',
    link: ['/recruitment', 'Register'],
  },
  {
    title: 'SAE Aero Design', date: null, place: 'United States',
    text: 'The international design-build-fly competition the team builds for every year: design report, presentation and flight rounds.',
    link: ['https://www.saeaerodesign.com/', 'Competition site'],
  },
  {
    title: 'Pradarshana', date: null, place: 'Ramaiah Institute of Technology',
    text: 'The college project exhibition, where the current aircraft goes on show.',
  },
];

const fmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const when = (date) => (date ? fmt.format(new Date(date)) : 'Date to be announced');
