import { useState, useRef, useEffect } from 'preact/hooks';

// useCountUp: anima 0→target al mount e current→target su cambio dato.
// Rispetta prefers-reduced-motion (snap). Estratto da Dashboard.jsx per riuso
// nel layout kit (StatTile) e in qualunque pagina che mostri numeri animati.
export function useCountUp(target, decimals = 0, dur = 900) {
  const to = Number(target) || 0;
  const [val, setVal] = useState(to);
  const fromRef = useRef(0);
  useEffect(() => {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(to);
      fromRef.current = to;
      return;
    }
    const from = fromRef.current;
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { setVal(to); fromRef.current = to; }
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [to]);
  return Number(val).toFixed(decimals);
}
