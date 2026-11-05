import { useEffect, useState } from 'react';
import { onSoundChange, setSound, soundOn } from '../lib/sound';
import { Sound, Muted } from './icons';

export default function SoundToggle() {
  const [on, setOn] = useState(true); // the server can't know; corrected on mount
  useEffect(() => { setOn(soundOn()); return onSoundChange(setOn); }, []);
  return (
    <button type="button" aria-pressed={on} aria-label="Interface sounds" title={on ? 'Sounds on' : 'Sounds off'}
      onClick={() => setSound(!on)} className="grid place-items-center size-11 hover:text-signal">
      <span className="icon-swap" data-state={on ? 'a' : 'b'}><Sound /><Muted /></span>
    </button>
  );
}
