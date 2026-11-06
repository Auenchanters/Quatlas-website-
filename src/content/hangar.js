// The hidden hangar (/hangar, linked as "secret" in the footer): its copy and the two games.
export const HANGAR = {
  title: 'The hangar',
  intro: 'You found it. Two games the team flies between build sessions.',
  games: [
    {
      slug: 'payload-run', label: '2D · one button', name: 'Payload Run',
      about: 'Fly the 012 from day into night, collecting payload between the pylons.',
      how: 'Hold to climb, let go to sink. Climbing drains the battery: grab cells to recharge. Collect payload crates and stay between the ground and the ceiling. The game plays full screen; Esc pauses it.',
      note: 'Score: one point per 10 m, fifty per kilogram of payload.',
    },
    {
      slug: 'dogfight', label: '3D · air combat', name: 'Dogfight',
      about: 'You against four. Arcade air combat over the islands, with guns and missiles.',
      how: 'Move the mouse to aim and the jet flies there; A / D or the arrow keys turn too. W / S for throttle, Q / E to roll. Click or Space to fire guns, F for missiles once locked. On a phone, use the stick and the fire buttons. The game plays full screen; Esc opens the menu.',
      note: 'Down all four to win. Score: time, accuracy and health left.',
    },
  ],
};
