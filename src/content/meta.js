// Each page's title and search/share description. Pages not listed here (a subteam, a game, not found)
// set their own with <Meta>. noindex: kept out of search results (and out of the sitemap).
export const SITE = 'https://quatlas-website.vercel.app';
export const NAME = 'Quatlas Aeromodelling';

export const META = {
  '/': { description: 'Quatlas is the aeromodelling team of Ramaiah Institute of Technology. We design, build and fly aircraft for SAE Aero Design.' },
  '/about': { title: 'About', description: 'Who Quatlas is: the aeromodelling team of Ramaiah Institute of Technology, designing, building and flying aircraft for SAE Aero Design.' },
  '/team': { title: 'Our team', description: 'Students from every branch at Ramaiah, organised the way an aircraft is: one core team and six subteams that each own a part of the build.' },
  '/achievements': { title: 'Achievements', description: 'Every competition Quatlas has entered since its first, with the results.' },
  '/events': { title: 'Events', description: 'What Quatlas is building towards next, and every competition the team has already flown.' },
  '/gallery': { title: 'Gallery', description: 'Photos of the aircraft Quatlas has built and flown, and of the people who built them.' },
  '/support': { title: 'Support', description: 'Quatlas is built by students and paid for by people who believe in it. Sponsor the team with parts, money or services, or chip in directly.' },
  '/contact': { title: 'Contact', description: 'Get in touch with Quatlas: send a request, find the team at Ramaiah Institute of Technology, or read the FAQs.' },
  '/alumini': { title: 'Alumni', description: 'Everyone who designed, built and flew for Quatlas before, and where they went next.' },
  '/recruitment': { title: 'Recruitment', description: 'Join Quatlas: what each subteam does, how recruitment works, and this year’s dates.' },
  '/terms': { title: 'Terms of use', description: 'The terms of use of the Quatlas Aeromodelling website.' },
  '/results': { title: 'Recruitment results', description: 'Check your Quatlas recruitment result with your USN.' },
  '/resultPage': { title: 'Your result', description: 'Your Quatlas recruitment result.', noindex: true },
  '/login': { title: 'Sign in', description: 'Sign in to the Quatlas dashboard.', noindex: true },
  '/signup': { title: 'Sign up', description: 'Create a Quatlas dashboard account.', noindex: true },
  '/resetPassword': { title: 'Reset password', description: 'Reset your Quatlas dashboard password.', noindex: true },
  '/verifyUser': { title: 'Verify your email', description: 'Verify your Quatlas dashboard account.', noindex: true },
  '/hangar': { title: 'The hangar', description: 'You found it. Two games the team flies between build sessions.', noindex: true },
};
