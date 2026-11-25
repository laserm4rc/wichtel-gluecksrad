import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Wheel.module.css';

// Klassische Weihnachtsfarben aus den Radix-Variablen: Rot, Grün, Weiß.
// Die Farben sehen in hellem und dunklem Modus gleich aus.
const PALETTE = [
  { fill: 'var(--red-9)', text: 'var(--red-contrast)' },
  { fill: 'var(--green-10)', text: 'var(--green-contrast)' },
  { fill: 'var(--white-a12)', text: 'var(--red-9)' },
] as const;

/** Mindestanzahl an Feldern, damit das Rad auch bei kleinen Gruppen voll aussieht. */
const MIN_SEGMENTS = 8;
const RADIUS = 96;
const LABEL_RADIUS = 80;
const SPIN_TURNS = 6;

interface WheelProps {
  names: string[];
  /** Name, auf dem das Rad stehen bzw. landen soll */
  target: string | null;
  /** Wird hochgezählt, um eine Drehung auszulösen */
  spinKey: number;
  /** Rad wirkt ausgegraut, solange noch nicht gedreht werden darf */
  idle?: boolean;
  onSpinEnd?: () => void;
}

/**
 * Das Glücksrad. Es ist nur Animation: Die Zuteilung steht vorher fest,
 * das Rad landet auf dem vorgegebenen Namen.
 */
export function Wheel({ names, target, spinKey, idle = false, onSpinEnd }: WheelProps) {
  const segments = useMemo(() => buildSegments(names), [names]);
  const step = 360 / Math.max(segments.length, 1);
  const reducedMotion = usePrefersReducedMotion();

  // Startet in zufälliger Stellung, damit vor dem Drehen irgendein Name unter dem Zeiger steht
  const [rotation, setRotation] = useState(() => Math.random() * 360);
  const [duration, setDuration] = useState(0);
  const lastSpinKey = useRef(spinKey);
  const spinning = useRef(false);

  useEffect(() => {
    if (spinKey === lastSpinKey.current || !target) return;
    lastSpinKey.current = spinKey;
    const indices = segments.flatMap((s, i) => (s.name === target ? [i] : []));
    if (indices.length === 0) return;

    // Zufälliges Feld mit dem Zielnamen, zufällige Stelle innerhalb des Feldes
    const index = indices[Math.floor(Math.random() * indices.length)];
    const jitter = (Math.random() - 0.5) * step * 0.7;
    const targetAngle = index * step + step / 2 + jitter;
    const turns = reducedMotion ? 1 : SPIN_TURNS;

    spinning.current = true;
    setDuration(reducedMotion ? 1200 : 5500);
    setRotation((current) => {
      const base = current - mod(current, 360) + turns * 360;
      return base + mod(360 - targetAngle, 360);
    });
  }, [spinKey, target, segments, step, reducedMotion]);

  const handleTransitionEnd = () => {
    if (!spinning.current) return;
    spinning.current = false;
    onSpinEnd?.();
  };

  const fontSize = segments.length > 16 ? 6 : segments.length > 10 ? 7.5 : 9;

  return (
    <div className={styles.wrapper}>
      <svg viewBox="-100 -108 200 208" className={`${styles.svg} ${idle ? styles.idle : ''}`} role="img" aria-label="Glücksrad">
        <g
          className={styles.disc}
          style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}ms` }}
          onTransitionEnd={handleTransitionEnd}
        >
          {segments.map((segment, i) => {
            const start = i * step;
            const middle = start + step / 2;
            return (
              <g key={i}>
                <path
                  d={slicePath(start, start + step, segments.length)}
                  className={styles.segment}
                  strokeWidth={0.5}
                  style={{ fill: segment.color.fill }}
                />
                <g transform={`rotate(${middle - 90})`}>
                  <text
                    x={LABEL_RADIUS}
                    y={0}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontSize={fontSize}
                    className={styles.segmentLabel}
                    style={{ fill: segment.color.text }}
                  >
                    {shorten(segment.name)}
                  </text>
                </g>
              </g>
            );
          })}
          <circle r={RADIUS} className={styles.rim} strokeWidth={1.5} />
        </g>
        <circle r={14} className={styles.hub} strokeWidth={1.5} />
        <path d="M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8 Z" className={styles.hubIcon} />
        {/* Zeiger oben */}
        <path d="M -8 -106 L 8 -106 L 0 -89 Z" className={styles.pointer} strokeWidth={2} />
      </svg>
    </div>
  );
}

interface Segment {
  name: string;
  color: (typeof PALETTE)[number];
}

function buildSegments(names: string[]): Segment[] {
  if (names.length === 0) return [];
  const repeat = Math.ceil(MIN_SEGMENTS / names.length);
  const list = Array.from({ length: repeat }, () => names).flat();
  // Rot, Grün, Weiß im Wechsel. Das letzte Feld grenzt ans erste, darf also keine der beiden Nachbarfarben haben.
  const colors = list.map((_, i) => PALETTE[i % PALETTE.length]);
  const last = colors.length - 1;
  if (last > 1 && colors[last] === colors[0]) {
    colors[last] = PALETTE.find((c) => c !== colors[0] && c !== colors[last - 1]) ?? colors[last];
  }
  return list.map((name, i) => ({ name, color: colors[i] }));
}

function slicePath(startDeg: number, endDeg: number, count: number) {
  if (count === 1) return `M 0 ${-RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 0 ${RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 0 ${-RADIUS} Z`;
  const [x1, y1] = point(startDeg);
  const [x2, y2] = point(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M 0 0 L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/** Winkel im Uhrzeigersinn ab 12 Uhr */
function point(deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [RADIUS * Math.sin(rad), -RADIUS * Math.cos(rad)];
}

function shorten(name: string) {
  return name.length > 14 ? `${name.slice(0, 13)}…` : name;
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
