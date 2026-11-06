// Local stand-in for quatlasserver.vercel.app, so dashboard writes can be tested without touching
// real data or sending real emails. Public lists are copied from the live API at start-up.
//   npm run mock      then   VITE_API=http://localhost:8787/api VITE_SHEET=http://localhost:8787/sheet npm run dev
// Test login (mock only): admin@quatlas.test / mock-password
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const LIVE = 'https://quatlasserver.vercel.app/api';
const USER = { id: 'u1', username: 'Mock Admin', email: 'admin@quatlas.test', password: 'mock-password' };
const TOKEN = 'mock-token';
const id = () => randomUUID().slice(0, 8);
const now = () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

async function live(path, fallback) {
  try { return await (await fetch(LIVE + path, { signal: AbortSignal.timeout(15000) })).json(); } catch { return fallback; }
}
const db = {
  members: (await live('/members/memberData', [{ teams: [] }]))[0],
  gallery: await live('/gallery/images', []),
  sponsors: await live('/spslist/items', []),
  dates: await live('/recruit/getDates', [{ _id: id(), date: 'TBD', time: 'TBD', formLink: '/', project: 'TBD', result: '/' }]),
  contact: [{ _id: id(), name: 'Test Student', usn: '1MS22ME002', ConNumber: '9000000000', message: 'Mock enquiry', createdAtIST: now() }],
  funding: [],
  teams: [{ year: '2025', recruitedNames: [{ _id: id(), name: 'Test Recruit', usn: '1MS23ME010', role: 'CAD', phoneNumber: '9000000001' }] }],
  links: [{ _id: id(), name: 'Recruitment form', link: 'https://example.com/form' }],
  sheet: [
    { Name: 'Asha R', Usn: '1MS24ME001', 'Branch & Semester': 'ME 3', Email: 'asha@example.com', 'Phone Number': '9000000002', 'Technical Team': 'Fabrication & Testing', 'Non Technical Team': '', 'Are you': 'Day Scholar' },
    { Name: 'Kiran M', Usn: '1MS24EC014', 'Branch & Semester': 'EC 3', Email: 'kiran@example.com', 'Phone Number': '9000000003', 'Technical Team': '', 'Non Technical Team': 'Sponsorships', 'Are you': 'Hosteller' },
  ],
  mails: [],
  results: { '1MS22ME002-T': { name: 'Test Student', usn: '1MS22ME002-T', status: 'selected', role: 'CAD', score: 42 } },
};
db.members._id ??= id();
const log = [];

const allMembers = () => db.members.teams.flatMap((t) => t.roleData);
const allRecruits = () => db.teams.flatMap((t) => t.recruitedNames);
const patch = (list, rid, body) => { const r = list.find((x) => x._id === rid); if (!r) return false; Object.assign(r, body); return true; };
const drop = (list, rid) => { const i = list.findIndex((x) => x._id === rid); if (i < 0) return false; list.splice(i, 1); return true; };

// [method, pattern, needsAuth, handler(body, param) => [status, json]]
const routes = [
  ['POST', '/auth/signin', false, (b) => b.email === USER.email && b.password === USER.password ? [200, { authToken: TOKEN }] : [400, { error: 'Invalid credentials' }]],
  ['POST', '/auth/signup', false, () => [200, { msg: 'Signed up (mock). Verify your email to continue.' }]],
  ['GET', '/auth/dashboard', true, () => [200, { username: USER.username, email: USER.email, id: USER.id }]],
  ['POST', '/auth/loginpasswordreset', false, () => [200, { msg: 'OTP sent (mock)' }]],
  // Like the hardened server: the code is checked together with the account's email.
  ['PUT', '/auth/resetpassword', false, (b) => !b.userEmail ? [400, { msg: 'The OTP you entered is invalid or has expired.' }]
    : b.userotp === '123456' ? [200, { msg: 'Password reset (mock)' }] : [400, { msg: 'Invalid OTP. The mock OTP is 123456.' }]],
  ['POST', '/auth/otpverification/:id', true, () => [200, { msg: 'OTP sent (mock)' }]],
  ['PUT', '/auth/updateEmailOrPassword/:id', true, (b) => b.userotp === '123456' ? [200, { msg: 'Updated (mock)' }] : [400, { msg: 'Invalid OTP. The mock OTP is 123456.' }]],
  ['PUT', '/auth/updateUsername/:id', true, (b) => typeof b.NewName === 'string' && b.NewName ? (USER.username = b.NewName, [200, { msg: 'Name updated', username: b.NewName }]) : [400, { msg: 'NewName must be a non-empty string' }]],
  ['DELETE', '/auth/deleteAccount/:id', true, () => [200, { msg: 'Account deleted (mock)' }]],

  ['GET', '/members/memberData', false, () => [200, [db.members]]],
  ['POST', '/members/addMember', true, (b) => {
    let t = db.members.teams.find((x) => x.roleName === b.roleName);
    if (!t) db.members.teams.push(t = { roleName: b.roleName, roleData: [] });
    t.roleData.push({ _id: id(), name: b.name, role: b.role, img: b.img, linkedin: b.linkedin });
    return [200, { msg: 'added' }];
  }],
  ['PUT', '/members/updateMember/:id', true, (b, p) => patch(allMembers(), p, b) ? [200, { msg: 'updated' }] : [404, { msg: 'Member not found' }]],
  ['DELETE', '/members/deleteMember/:id', true, (b, p) => db.members.teams.some((t) => drop(t.roleData, p)) ? [200, { msg: 'deleted' }] : [404, { msg: 'Member not found' }]],

  ['GET', '/gallery/images', false, () => [200, db.gallery]],
  ['POST', '/gallery/addImage', true, (b) => (db.gallery.push({ _id: id(), img: b.img }), [200, { msg: 'added' }])],
  ['DELETE', '/gallery/delete/:id', true, (b, p) => drop(db.gallery, p) ? [200, { msg: 'deleted' }] : [404, { msg: 'Image not found' }]],

  ['POST', '/form/addcon', false, (b) => (db.contact.push({ _id: id(), ...b, createdAtIST: now() }), [200, { msg: 'Thank you! We will get back to you soon.' }])],
  ['POST', '/form/addsp', false, (b) => (db.funding.push({ _id: id(), ...b, createdAtIST: now() }), [200, { msg: 'Thank you for supporting Quatlas!' }])],
  ['GET', '/form/condata', true, () => [200, db.contact]],
  ['GET', '/form/spdata', true, () => [200, db.funding]],

  ['GET', '/spslist/items', false, () => [200, db.sponsors]],
  ['POST', '/spslist/addItems', true, (b) => (db.sponsors.push({ _id: id(), ...b }), [200, { msg: 'Sponsor added' }])],
  ['PUT', '/spslist/updateItems/:id', true, (b, p) => patch(db.sponsors, p, b) ? [200, { msg: 'Sponsor updated' }] : [404, { msg: 'Sponsor not found' }]],
  ['DELETE', '/spslist/deleteItems/:id', true, (b, p) => drop(db.sponsors, p) ? [200, { msg: 'Sponsor deleted' }] : [404, { msg: 'Sponsor not found' }]],

  ['GET', '/teams/list', true, () => [200, { data: [{ teams: db.teams }] }]],
  ['POST', '/teams/add', true, (b) => {
    let t = db.teams.find((x) => x.year === b.year);
    if (!t) db.teams.push(t = { year: b.year, recruitedNames: [] });
    t.recruitedNames.push({ _id: id(), name: b.name, usn: b.usn, role: b.role, phoneNumber: b.phoneNumber });
    return [200, { msg: 'Recruit added' }];
  }],
  ['PUT', '/teams/update/:id', true, (b, p) => patch(allRecruits(), p, b) ? [200, { msg: 'Recruit updated' }] : [404, { msg: 'Recruit not found' }]],
  ['DELETE', '/teams/delete/:id', true, (b, p) => db.teams.some((t) => drop(t.recruitedNames, p)) ? [200, { msg: 'Recruit deleted' }] : [404, { msg: 'Recruit not found' }]],

  ['GET', '/links/getLinks', true, () => [200, db.links]],
  ['POST', '/links/add', true, (b) => (db.links.push({ _id: id(), ...b }), [200, { msg: 'Link added' }])],
  ['PUT', '/links/update/:id', true, (b, p) => patch(db.links, p, b) ? [200, { msg: 'Link updated' }] : [404, { msg: 'Link not found' }]],
  ['DELETE', '/links/delete/:id', true, (b, p) => drop(db.links, p) ? [200, { msg: 'Link deleted' }] : [404, { msg: 'Link not found' }]],

  ['GET', '/recruit/getDates', false, () => [200, db.dates]],
  ['PUT', '/recruit/updateDates/:id', true, (b, p) => patch(db.dates, p, b) ? [200, { msg: 'Dates updated' }] : [404, { msg: 'Dates not found' }]],
  ['DELETE', '/recruit/deleteDates/:id', true, (b, p) => drop(db.dates, p) ? [200, { msg: 'Dates deleted' }] : [404, { msg: 'Dates not found' }]],

  ['GET', '/hiring/getschedules', true, () => [200, { msg: 'Schedules received', list: [{ _id: 'h1', mails: db.mails }] }]],
  ['POST', '/hiring/addData', true, () => {
    for (const s of db.sheet) if (!db.mails.some((m) => m.Usn === s.Usn)) db.mails.push({ _id: id(), ...s, Score: '30', Status: '' });
    return [200, { msg: `Imported ${db.sheet.length} applications (mock)` }];
  }],
  ['POST', '/hiring/addextra', true, (b) => (db.mails.push({ _id: id(), Name: b.Name, Usn: b.Usn, 'Branch & Semester': b.BranchAndSemester, Email: b.Email, 'Phone Number': b.PhoneNumber, 'Technical Team': b.TechnicalTeam, 'Non Technical Team': b.NonTechnicalTeam, 'Are you': b.AreYou, Score: b.Score, Status: '' }), [200, { msg: 'Member added' }])],
  ['POST', '/hiring/interview', true, (b) => {
    let slot = 0;
    for (const m of db.mails.filter((x) => Number(x.Score) >= Number(b.score || 0))) {
      m['Interview Date'] = b.date;
      m.Time = `${b.startTime} +${Math.floor(slot++ / Number(b.capacity || 1)) * Number(b.interval || 15)} min`;
    }
    return [200, { msg: 'Interviews scheduled (mock)' }];
  }],
  ['POST', '/hiring/interviewMails', true, (b) => [200, { msg: `Mail to ${b.mail} recorded (mock, not sent)` }]],
  ['PUT', '/hiring/updateSelecttion/:id', true, (b, p) => patch(db.mails, p, { Status: b.statusValue }) ? [200, { msg: `Status set to ${b.statusValue}` }] : [404, { msg: 'Candidate not found' }]],
  ['POST', '/hiring/testLink', true, (b) => [200, { msg: `Test link ${b.testLink} recorded (mock, not sent)` }]],
  ['POST', '/hiring/finalMail', true, (b) => [200, { msg: `Final mail with ${b.groupLink} recorded (mock, not sent)` }]],
  ['DELETE', '/hiring/deleteHiringData', true, () => (db.mails = [], [200, { msg: 'Hiring data deleted' }])],

  ['POST', '/results/check', false, (b) => db.results[b.usn] ? [200, db.results[b.usn]] : [404, { msg: 'Usn not found!!' }]],
];

function match(method, path) {
  for (const [m, pattern, needsAuth, fn] of routes) {
    if (m !== method) continue;
    const re = new RegExp('^/api' + pattern.replace(':id', '([^/]+)') + '/?$');
    const hit = path.match(re);
    if (hit) return { needsAuth, fn, param: hit[1] && decodeURIComponent(hit[1]) };
  }
}

http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204, {});
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname === '/sheet') return send(200, db.sheet);
  if (pathname === '/log') return send(200, log);
  let raw = '';
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  const r = match(req.method, pathname);
  if (!r) return send(404, { msg: `No mock for ${req.method} ${pathname}` });
  if (r.needsAuth && req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'unauthorized', msg: 'Unauthorized' });
  const [status, out] = r.fn(body, r.param);
  log.push({ method: req.method, path: pathname, body, status });
  send(status, out);
}).listen(8787, () => console.log('mock API on http://localhost:8787/api'));
