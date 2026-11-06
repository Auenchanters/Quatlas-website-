// The current team, from the club's roster sheet (November 2026). The team and subteam pages read
// this, not the dashboard; alumni still come from the dashboard. Photos: assets-src/team-<name>.jpg
// (run `npm run images` after adding one). A person in two subteams is listed in both.
// `roleName` decides the page: "Core", or a name in a subteam's `match` (src/content/teams.js).

const person = (name, role, photo, linkedin) => ({ name, role, img: photo && `team-${photo}`, linkedin });

export const TEAMS = [
  {
    roleName: 'Core',
    roleData: [
      person('Utkarsh Shinde', 'Captain', 'utkarsh', 'https://www.linkedin.com/in/utkarsh-shinde-18b3a936a/'),
      person('Chavi Bohra', 'Vice-Captain', 'chavi', 'https://www.linkedin.com/in/chavi-bohra-8b2625366/'),
      person('Rajan Bharadwaj', 'Core Member', 'rajan'),
      person('Tushar P R', 'Core Member', 'tushar'),
      person('Arjun V', 'Core Member', 'arjun', 'https://www.linkedin.com/in/arjun-av/'),
      person('Vignesh Iyer', 'Core Member', 'vignesh'),
    ],
  },
  {
    roleName: 'Aerodynamics',
    roleData: [
      person('Mohith J', 'Lead', 'mohith', 'https://www.linkedin.com/in/mohith-jagadish-281ba925a'),
      person('Aneesh Agumbe', 'Co-Lead', 'aneesh'),
      person('Mriganki Tripati', 'Co-Lead', 'mriganki'),
      person('B Mauli', 'Member', 'mauli'),
    ],
  },
  {
    roleName: 'Avionics',
    roleData: [
      person('Syed Ahmed', 'Lead', 'syed-ahmed'),
      person('Kartik', 'Co-Lead', 'kartik'),
      person('Sinchan', 'Member', 'sinchan'),
    ],
  },
  {
    roleName: 'Social Media',
    roleData: [
      person('Kartik', 'Lead', 'kartik'),
      person('Sinchan', 'Co-Lead', 'sinchan'),
    ],
  },
  {
    roleName: 'Design',
    roleData: [
      person('Twisha Kalra', 'Lead', 'twisha'),
      person('Sumedha Gramle', 'Lead'), // no photo yet: the card shows her initials
      person('Syed Sabi', 'Co-Lead', 'syed-sabi'),
      person('Milind S', 'Member', 'milind'),
      person('Srishti Pravin', 'Member', 'srishti'),
    ],
  },
  {
    roleName: 'Web Development',
    roleData: [
      person('Meenakshi K', 'Lead', 'meenakshi'),
      person('Niyati Yadav', 'Co-Lead', 'niyati'),
      person('Ishani', 'Co-Lead', 'ishani'),
    ],
  },
];

// Headcount for the home page: each person once, however many subteams they're in.
export const ROSTER_SIZE = new Set(TEAMS.flatMap((t) => t.roleData.map((p) => p.name))).size;
