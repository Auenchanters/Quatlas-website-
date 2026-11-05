// Contact page: PEOPLE (contacts shown), TYPES (form request types), FAQ ([question, answer]; answers may hold links).
import { Link } from 'react-router';

export const PEOPLE = [
  // The old page listed "urstrulypuneethgmail.com" (missing the @); corrected here.
  ['Team leader - Puneeth L', 'urstrulypuneeth@gmail.com', '+91 91488 43472'],
  ['Non Tech - Pavan A', 'pavan.aashok1234gh@gmail.com', '+91 7676475397'],
];

export const TYPES = ['General query', 'Sponsorship', 'Joining the team', 'Collaboration or workshop', 'Media'];

export const FAQ = [
  ['How do I join Quatlas?', <>Recruitment opens once a year. Watch the <Link to="/events">events page</Link> and our Instagram, then register on the <Link to="/recruitment">recruitment page</Link>. It runs in three steps: a written assessment of basic science and maths, a few rounds of interview, and a group project.</>],
  ['Do I need aeromodelling experience?', 'No. We look for curiosity and commitment; the team teaches the rest, from CAD to soldering to flying.'],
  ['Is it only for technical roles?', <>No. The Non-Tech team runs sponsorship, reports and presentations, social media, creative design and this website. See <Link to="/team/non-tech">Non-Tech</Link>.</>],
  ['How can my company sponsor the team?', <>We take parts, money and services. Choose “Sponsorship” in the form on this page, or read the options on <Link to="/support">Support</Link>.</>],
  ['Can I donate as an individual?', <>Yes. Pay any amount over UPI in the <Link to="/support#crowdfunding">crowdfunding section</Link> and leave your details so we can thank you.</>],
  ['Where is the team based?', 'In the R&D-1 Laboratory, ESB II, room 119, at Ramaiah Institute of Technology, Mathikere, Bengaluru.'],
];
