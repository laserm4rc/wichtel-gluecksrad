import { useCallback, useEffect, useState } from 'react';

export type Appearance = 'light' | 'dark';

const STORAGE_KEY = 'wichtel-appearance';
const query = () => window.matchMedia('(prefers-color-scheme: dark)');

function readStored(): Appearance | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Hell/Dunkel: folgt dem System, bis die Person selbst umschaltet.
 * Die eigene Wahl wird im Browser gemerkt.
 */
export function useAppearance() {
  const [stored, setStored] = useState<Appearance | null>(readStored);
  const [system, setSystem] = useState<Appearance>(() => (query().matches ? 'dark' : 'light'));

  useEffect(() => {
    const mq = query();
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const appearance = stored ?? system;

  const toggle = useCallback(() => {
    const next: Appearance = appearance === 'dark' ? 'light' : 'dark';
    setStored(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Speichern ist nur Komfort
    }
  }, [appearance]);

  return { appearance, toggle };
}
