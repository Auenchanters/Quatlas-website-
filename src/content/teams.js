import { useApi } from '../lib/api';
import snapshot from './snapshot.json';

// Subteams of the club. Members come from the dashboard: a member shows on a subteam page when their
// "Team name" matches one of `match` (case-insensitive). CAED and Conceptual are the names already in the data.
export const SUBTEAMS = [
  {
    slug: 'avionics', name: 'Avionics', match: ['avionics', 'electronics', 'electrical'],
    about: 'Wires the aircraft and makes it fly: motor and battery selection, receivers, servos, power distribution and the payload release. Avionics owns every bench test before the first flight.',
    work: ['Propulsion and battery sizing', 'Servo, receiver and ESC integration', 'Wiring harness and power budget', 'Bench and range tests'],
  },
  {
    slug: 'aerodynamics', name: 'Aerodynamics', match: ['aerodynamics', 'aerodynamic', 'aero', 'conceptual'],
    about: 'Turns the mission rules into a wing. Airfoil choice, sizing, stability and performance estimates start here, long before anything is cut.',
    work: ['Conceptual sizing against the mission', 'Airfoil selection and CFD', 'Stability and control analysis', 'Performance and payload prediction'],
  },
  {
    slug: 'design', name: 'Design', match: ['design', 'caed', 'cad'],
    about: 'Builds the aircraft in CAD first. Every rib, spar and bracket is modelled, checked for fit and drawn for manufacture.',
    work: ['3D CAD of the full airframe', 'Assembly and fit checks', 'Manufacturing drawings', 'Technical design report figures'],
  },
  {
    slug: 'structures', name: 'Structures', match: ['structures', 'structure', 'manufacturing', 'fabrication'],
    about: 'Makes the airframe light enough to lift a heavy payload and strong enough to land. Material choice, load analysis and the build itself.',
    work: ['Load cases and FEA', 'Material and joint selection', 'Laser cutting, layup and assembly', 'Repairs at the field'],
  },
  {
    slug: 'non-tech', name: 'Non-Tech', match: ['non technical', 'non-technical', 'non tech', 'non-tech', 'management'],
    about: 'Keeps the team running: sponsorship, finance, outreach, social media and events. Nothing reaches the competition without them.',
    work: ['Sponsorship and partnerships', 'Budget and procurement', 'Social media and design', 'Events and outreach'],
  },
];

export const TEAM_INTRO = 'Students from every branch at Ramaiah, organised the way an aircraft is: one core team and five subteams that each own a part of the build.';

// The buttons on /team: every subteam, then the alumni.
export const TILES = [
  ...SUBTEAMS.map((s) => ({ slug: s.slug, name: s.name, to: `/team/${s.slug}` })),
  { slug: 'alumni', name: 'Alumni', to: '/alumini' },
];

const norm = (s = '') => s.trim().toLowerCase();
export const subteamOf = (roleName) => SUBTEAMS.find((s) => s.match.includes(norm(roleName)));
export const isCore = (roleName) => norm(roleName) === 'core';
export const isAlumni = (roleName) => ['alumini', 'alumni'].includes(norm(roleName));

// Order people the way the wireframe draws them: captain, vice-captain, heads and leads, then everyone else.
// Checked in this order (co-lead before lead, since "Co-Lead" also contains "lead").
const RANK = [[/vice|v-?cap/i, 1], [/captain|team lead/i, 0], [/head/i, 2], [/pilot/i, 3], [/co-?lead/i, 5], [/lead/i, 4]];
const rank = (role = '') => RANK.find(([r]) => r.test(role))?.[1] ?? 9;
export const byRole = (people) => [...people].sort((a, b) => rank(a.role) - rank(b.role));

// Every member of one subteam, from all matching team names.
export const membersOf = (teams, sub) => byRole(teams.filter((t) => sub.match.includes(norm(t.roleName))).flatMap((t) => t.roleData));

// Every team from the dashboard, prerendered from the build-time snapshot.
export const useTeams = () => useApi('/members/memberData', { initial: snapshot.members, map: (d) => d[0].teams });
