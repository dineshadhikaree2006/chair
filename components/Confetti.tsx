'use client';

import { useEffect, useState, type CSSProperties } from 'react';

/** One brief celebration per mounted certificate; no motion for reduced-motion users. */
export function Confetti() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    setActive(true);
    const stop = () => setActive(false);
    const timeout = window.setTimeout(stop, 2400);
    preference.addEventListener('change', stop);
    return () => {
      window.clearTimeout(timeout);
      preference.removeEventListener('change', stop);
    };
  }, []);

  if (!active) return null;
  return <div className="confetti" aria-hidden="true" data-testid="confetti">
    {Array.from({ length: 32 }, (_, i) => <i key={i} style={{
      '--x': `${(i * 37) % 100}%`,
      '--drift': `${((i * 53) % 240) - 120}px`,
      '--delay': `${(i % 5) * 65}ms`,
      '--rotation': `${180 + (i * 71) % 540}deg`,
      backgroundColor: ['#f5ed31', '#202019', '#65967c', '#df8067'][i % 4],
    } as CSSProperties} />)}
  </div>;
}
