// Contact page: PEOPLE (contacts shown), TYPES (form request types), FAQ ([question, answer]; answers may hold links).
import { Link } from 'react-router';

export const PEOPLE = [
  ['Kartik, Non-Tech Head', 'kartikmashetty@gmail.com', '+91 85508 40787'],
];

export const TYPES = ['General query', 'Sponsorship', 'Joining the team', 'Collaboration or workshop', 'Media'];

export const FAQ = [
  ['How do I join Quatlas?', <>Recruitment opens once a year. Watch the <Link to="/events">events page</Link> and our Instagram, then register on the <Link to="/recruitment">recruitment page</Link>. Selection has three steps: a written test of basic science and maths, a few interviews, and a group project.</>],
  ['Do I need aeromodelling experience?', 'No. Bring curiosity and commitment, and we’ll teach you the rest: CAD, soldering, flying.'],
  ['Is it only for technical roles?', <>No. <Link to="/team/social-media">Social Media</Link> runs the team’s posts and event coverage, and <Link to="/team/web-development">Web Development</Link> builds this website.</>],
  ['How can my company sponsor the team?', <>We take parts, money and services. Choose “Sponsorship” in the form on this page, or read the options on <Link to="/support">Support</Link>.</>],
  ['Can I donate as an individual?', <>Yes. Pay any amount over UPI in the <Link to="/support#crowdfunding">crowdfunding section</Link> and leave your details so we can thank you.</>],
  ['Where is the team based?', 'In the R&D-1 Laboratory, ESB II, room 119, at Ramaiah Institute of Technology, Mathikere, Bengaluru.'],
];
