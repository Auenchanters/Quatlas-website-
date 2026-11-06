import { useApi } from '../lib/api';
import snapshot from './snapshot.json';

// Subteams of the club, in the order they're shown everywhere (tiles, the subteam nav, "Next:" links). A person shows on a subteam page when their team's
// name in the dashboard (`roleName`) matches one of `match`, case-insensitive. oneRow: everyone on the
// page in one row of big photos, instead of leads big and members smaller below.
export const SUBTEAMS = [
  {
    slug: 'aerodynamics', name: 'Aerodynamics', match: ['aerodynamics', 'aerodynamic', 'aero', 'conceptual'], oneRow: true,
    about: 'Turns the mission rules into a wing. Airfoil choice, sizing, stability and performance estimates start here, long before anything is cut.',
    work: ['Conceptual sizing against the mission', 'Airfoil selection and CFD', 'Stability and control analysis', 'Performance and payload prediction'],
  },
  {
    slug: 'avionics', name: 'Avionics', match: ['avionics', 'electronics', 'electrical'], oneRow: true,
    about: 'Wires the aircraft and makes it fly: motor and battery selection, receivers, servos, power distribution and the payload release. Avionics owns every bench test before the first flight.',
    work: ['Propulsion and battery sizing', 'Servo, receiver and ESC integration', 'Wiring harness and power budget', 'Bench and range tests'],
  },
  {
    slug: 'design', name: 'Design', match: ['design', 'caed', 'cad'],
    about: 'Builds the aircraft in CAD first. Every rib, spar and bracket is modelled, checked for fit and drawn for manufacture.',
    work: ['3D CAD of the full airframe', 'Assembly and fit checks', 'Manufacturing drawings', 'Technical design report figures'],
  },
  {
    slug: 'web-development', name: 'Web Development', match: ['web development', 'web-development', 'web'],
    about: 'Builds and runs this website: the team pages, the gallery, recruitment, and the dashboard the club uses to keep it current.',
    work: ['The public website', 'The admin dashboard and its server', 'Recruitment and contact forms', 'Hosting, security and speed'],
  },
  {
    slug: 'social-media', name: 'Social Media', match: ['social media', 'social-media'],
    about: 'Tells the team’s story: the posts, photos and videos that follow every build, flight and competition, and the face Quatlas shows sponsors and new members.',
    work: ['Posts from the workshop and the field', 'Photo and video coverage at events', 'Content for sponsors and outreach', 'Recruitment campaigns'],
  },
  {
    slug: 'pilots', name: 'Pilots', match: ['pilot', 'pilots'], oneRow: true,
    about: 'Fly the aircraft. The pilots take every airframe up at test flights and at competitions, and bring what it did in the air back to the people who designed and wired it.',
    work: ['Flying at test flights and competitions', 'Pre-flight checks on the field', 'Trimming and flight testing', 'Flight feedback to Design and Avionics'],
  },
];

export const TEAM_INTRO = 'Students from every branch at Ramaiah, organised the way an aircraft is: one core team and six subteams that each own a part of the build.';

// The buttons on /team: one per subteam. (Alumni have their own page, linked from the nav and footer.)
export const TILES = SUBTEAMS.map((s) => ({ slug: s.slug, name: s.name, to: `/team/${s.slug}` }));

const norm = (s = '') => s.trim().toLowerCase();
export const subteamOf = (roleName) => SUBTEAMS.find((s) => s.match.includes(norm(roleName)));
export const isCore = (roleName) => norm(roleName) === 'core';
export const isAlumni = (roleName) => ['alumini', 'alumni'].includes(norm(roleName));

// Order people the way the wireframe draws them: captain, vice-captain, the non-technical head, other heads,
// pilots and leads, then everyone else. The first pattern a role matches wins, so "Vice-Captain" is caught
// before "captain", "Non-Technical Head" before "head", "Co-Pilot" before "pilot", "Co-Lead" before "lead".
const RANK = [[/vice|v-?cap/i, 1], [/captain|team lead/i, 0], [/non-?tech/i, 2], [/head/i, 3], [/co-?pilot/i, 5], [/pilot/i, 4], [/co-?lead/i, 7], [/lead/i, 6]];
const rank = (role = '') => RANK.find(([r]) => r.test(role))?.[1] ?? 9;
export const byRole = (people) => [...people].sort((a, b) => rank(a.role) - rank(b.role));
// The Core team's top row: captain, vice-captain and the non-technical head.
export const isCoreLead = (p) => rank(p.role) <= 2;

// Every member of one subteam, from all matching team names.
export const membersOf = (teams, sub) => byRole(teams.filter((t) => sub.match.includes(norm(t.roleName))).flatMap((t) => t.roleData));

// Every team in the dashboard (the admin panel edits it), prerendered from the build-time snapshot.
export const useTeams = () => useApi('/members/memberData', { initial: snapshot.members, map: (d) => d[0].teams });

