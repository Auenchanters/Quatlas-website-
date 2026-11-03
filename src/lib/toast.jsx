import { useSyncExternalStore } from 'react';

let items = [];
const subs = new Set();
const emit = () => subs.forEach((f) => f());

function push(kind, text) {
  const id = Math.random();
  items = [...items, { id, kind, text: String(text) }];
  emit();
  setTimeout(() => { items = items.filter((t) => t.id !== id); emit(); }, 5000);
}

export const toast = { success: (t) => push('ok', t), error: (t) => push('error', t) };

export function Toaster() {
  const list = useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => items, () => items);
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 grid gap-2 sm:w-96">
      {list.map((t) => (
        <p key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
          className={`px-4 py-3 text-sm border bg-sheet shadow-[0_6px_20px_-8px_rgb(22_24_27/0.35)] ${t.kind === 'error' ? 'border-signal text-signal-ink' : 'border-ink'}`}>
          {t.text}
        </p>
      ))}
    </div>
  );
}
