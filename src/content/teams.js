import { useApi } from '../lib/api';
import snapshot from './snapshot.json';
import photos from './images.json';

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
    about: 'Wires the aircraft: motor and battery, receiver, servos, power and the payload release. Every bench test before the first flight is theirs.',
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
    about: 'Tells the team’s story in posts, photos and videos from every build, flight and competition. It’s how most sponsors and new members first see Quatlas.',
    work: ['Posts from the workshop and the field', 'Photo and video coverage at events', 'Content for sponsors and outreach', 'Recruitment campaigns'],
  },
  {
    slug: 'pilots', name: 'Pilots', match: ['pilot', 'pilots'], oneRow: true,
    about: 'Fly the aircraft at test flights and competitions, then tell Design and Avionics how it handled.',
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

// Fill-ins for what the dashboard doesn't have yet, so the site is right without an admin edit. Each one
// steps aside once the dashboard has it:
// - a member with no photo link (…/img/none) gets the site's own team-<first name> photo, if there is one;
// - a member whose LinkedIn is missing or the club page gets their own link from LINKEDIN, by name;
// - Core with no non-technical head gets Kartik, with the photo and LinkedIn from his other team.
const LINKEDIN = {
  'aneesh agumbe': 'https://www.linkedin.com/in/aneesh-agumbe-02b08a367/',
  'mriganki tripati': 'https://www.linkedin.com/in/mriganki-tripathi-5a0491366/',
  'b mauli': 'https://www.linkedin.com/in/b-mauli-76aa55375',
  'syed ahmed': 'https://www.linkedin.com/in/syed-abid-ahmed-50885a30a/',
  kartik: 'https://www.linkedin.com/in/kartik-mashetty/',
  sinchan: 'https://www.linkedin.com/in/sinchan-y-r-1a215937b/',
  'twisha kalra': 'https://www.linkedin.com/in/twisha-kalra-752181344/',
  'sumedha gramle': 'https://www.linkedin.com/in/sumedha-gramle-a44660355/',
  'syed sabi': 'https://www.linkedin.com/in/syed-sabi/',
  'milind s': 'https://www.linkedin.com/in/milind-mugali-5a1404366/',
  'srishti pravin': 'https://www.linkedin.com/in/srishti-gokhe-421038383/',
  'meenakshi k': 'https://www.linkedin.com/in/meenakshi-k123/',
  'niyati yadav': 'https://www.linkedin.com/in/niyati-yadav-31909038a/',
};
const first = (name = '') => name.trim().split(/\s+/)[0].toLowerCase();
const withPhoto = (p) => (/\/img\/none$/.test(p.img ?? '') && photos[`team-${first(p.name)}`] ? { ...p, img: `team-${first(p.name)}` } : p);
const withLinkedIn = (p) => (LINKEDIN[norm(p.name)] && (!p.linkedin || /linkedin\.com\/company\/quatlas/i.test(p.linkedin)) ? { ...p, linkedin: LINKEDIN[norm(p.name)] } : p);
function fillIn(teams) {
  const out = teams.map((t) => ({ ...t, roleData: t.roleData.map((p) => withLinkedIn(withPhoto(p))) }));
  const core = out.find((t) => isCore(t.roleName));
  const kartik = out.flatMap((t) => t.roleData).find((p) => norm(p.name) === 'kartik');
  if (core && kartik && !core.roleData.some((p) => /non-?tech/i.test(p.role ?? ''))) core.roleData = [...core.roleData, { ...kartik, _id: 'site-kartik-core', role: 'Non-Tech Head' }];
  return out;
}

// Every team in the dashboard (the admin panel edits it), prerendered from the build-time snapshot.
export const useTeams = () => useApi('/members/memberData', { initial: snapshot.members, map: (d) => fillIn(d[0].teams) });

