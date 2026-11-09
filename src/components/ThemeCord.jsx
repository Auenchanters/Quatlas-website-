import { useEffect, useState } from 'react';
import { currentTheme, flipTheme } from '../lib/theme';
import { playSound } from '../lib/sound';
import { afterLoad } from '../lib/idle';

// The theme switch: a pull cord hanging from the top of the page (pullcord, loaded after hydration
// so neither it nor its motion library lands in the entry chunk). Click and Enter work too.
export default function ThemeCord() {
  const [Cord, setCord] = useState(null);
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(currentTheme() === 'light');
    // Once the page has loaded: the cord's code (with its motion library) is no part of the first paint.
    return afterLoad(() => Promise.all([import('pullcord'), import('pullcord/pullcord.css')]).then(([m]) => setCord(() => m.PullCord)));
  }, []);
  if (!Cord) return null;
  const pull = () => {
    const k = document.querySelector('.pullcord-knob')?.getBoundingClientRect();
    setLight(flipTheme(k && { x: k.left + k.width / 2, y: k.top + k.height / 2 }) === 'light');
    playSound('click');
  };
  // The drop-in on load repaints the rope and its shadowed knob every frame for a few seconds: on a phone
  // that was most of the page's main-thread work while it loaded, so there the cord simply hangs, ready.
  return <Cord onPull={pull} pulled={light} ariaLabel="Toggle theme" noEntrance={!matchMedia('(pointer: fine)').matches} />;
}
