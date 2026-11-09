// Support page copy. UPI: payee for the crowdfunding QR code (pa = UPI ID, pn = name shown to the payer).
export const INTRO = 'Quatlas is built by students and paid for by people who believe in it. Sponsor the team with parts, money or services, or chip in directly.';

export const CROWDFUNDING = {
  heading: 'Crowdfunding',
  text: 'Every rupee goes into the aircraft and the trip to competition: balsa and carbon, motors and batteries, registration and travel. Scan to pay over UPI, any amount.',
  after: 'After you pay, leave your details so the team can thank you and keep you updated.',
};

export const UPI = { pa: 'mohithjagadish28@oksbi', pn: 'Mohith Jagadish' };

// Dashboard supporters (by _id) whose logos have navy or grey lettering, flipped light on the dark theme.
// shortcut: a new supporter with dark lettering needs its _id added here, until the dashboard can mark it.
export const DARK_LOGOS = new Set([
  '68903e8254095ad9cfbe2470', // Nalanda
  '68903ed90886e2dc097c6795', // Ramaiah Institute of Technology
  '68903fa154095ad9cfbe2478', // Dream Homes Developers
  '6890400464da3b8d9415bc7f', // Smart Links Technologies
]);
