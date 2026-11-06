// Upcoming events. Edit this list to add one: date is 'YYYY-MM-DD' or null while it is not announced.
// Past competitions come from achievements.js, so they never need entering twice.
export const UPCOMING = [
  {
    title: 'Techfest, IIT Bombay', date: null, place: 'IIT Bombay, Mumbai',
    text: 'The annual science and technology festival of IIT Bombay.',
  },
  {
    title: 'Boeing Competition', date: null, place: 'IIT Kanpur',
    text: 'The Boeing competition, held at IIT Kanpur.',
  },
];

const fmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const when = (date) => (date ? fmt.format(new Date(date)) : 'Date to be announced');
