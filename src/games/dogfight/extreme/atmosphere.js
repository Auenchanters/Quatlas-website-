// Time of day and weather for Dogfight Extreme, as plain numbers: the renderer reads the look, the
// worker reads the rules (how far a seeker sees through rain, how much a storm throws the jet about).

export const TIMES = ['day', 'night'], WEATHERS = ['clear', 'rain', 'storm'];

export function atmosphere(time = 'day', weather = 'clear') {
  const night = time === 'night', wet = weather !== 'clear', storm = weather === 'storm';
  return {
    time, weather,
    // Clear days use the physical sky; overcast and night skies are a flat colour the fog fades into.
    sky: !night && !wet,
    background: night ? (wet ? '#010204' : '#03050c') : storm ? '#3f4750' : wet ? '#76818c' : '#a9bccd',
    fog: night ? (wet ? [250, 2600] : [1200, 6500]) : storm ? [350, 3200] : wet ? [600, 4600] : [2800, 11000],
    sun: night ? (wet ? 0.02 : 0.1) : storm ? 0.35 : wet ? 0.9 : 3, // night: a faint moon, just enough for silhouettes
    sunColor: night ? '#8ea6d8' : '#fff0da',
    hemi: night ? 0.04 : storm ? 0.45 : wet ? 0.6 : 0.55,
    env: night ? 0.04 : storm ? 0.12 : wet ? 0.25 : 0.75, // low under cloud: no sun glint off the sea
    clouds: night ? 0.02 : storm ? 0.42 : wet ? 0.68 : 1, // how lit the cloud puffs are
    stars: night && !wet,
    rain: storm ? 1 : wet ? 0.55 : 0, // share of the rain streaks drawn
    waves: storm ? 0.55 : wet ? 0.3 : 0.18, // sea normal strength
    lightning: storm,
    lockRange: storm ? 1000 : wet ? 1300 : 1600,
    turbulence: storm ? 0.22 : wet ? 0.06 : 0,
    inside: night ? '8,10,14' : storm ? '104,112,120' : wet ? '160,168,176' : '232,237,242', // a cloud's inside, for the HUD's whiteout
  };
}

// Storm buffeting: a smooth, repeatable wobble added to the stick (−k..k), different per plane.
export function turbulence(t, i, k) {
  if (!k) return { pitch: 0, roll: 0 };
  const a = t * 1.7 + i * 13.1;
  return { pitch: k * (Math.sin(a) * 0.6 + Math.sin(a * 2.9 + 1.3) * 0.4), roll: k * (Math.sin(a * 1.3 + 4.1) * 0.6 + Math.sin(a * 3.7) * 0.4) };
}

// Lightning: the next strike comes 3–11 s after the last; thunder arrives at the speed of sound.
export const nextStrike = (rand) => 3 + rand * 8;
export const thunderDelay = (metres) => metres / 343;
