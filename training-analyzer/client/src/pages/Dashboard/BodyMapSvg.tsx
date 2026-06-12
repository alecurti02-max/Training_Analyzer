import type { RegionId } from './logic/muscleMap';

export interface RegionFill {
  color: string;   // CSS color (token var); '' = neutro
  opacity: number; // 0–1
  title: string;   // tooltip nativo
}

// Mappa anatomica stilizzata: due figure (fronte + retro) composte da blocchi
// muscolari arrotondati. Le regioni non colorate restano neutre; le parti non
// muscolari (testa, mani, bacino, ginocchia, piedi) sono sempre neutre.
// I fill arrivano per regione: una regione può comparire in entrambe le viste
// (es. avambracci) e viene colorata ovunque.
type Shape =
  | { k: 'rect'; x: number; y: number; w: number; h: number; r: number }
  | { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'path'; d: string };

const NEUTRAL: Shape[] = [
  // — fronte (cx 55) —
  { k: 'ellipse', cx: 55, cy: 15, rx: 9, ry: 10 },     // testa
  { k: 'rect', x: 51, y: 24, w: 8, h: 7, r: 2 },       // collo
  { k: 'path', d: 'M45 81 L65 81 L62 93 L48 93 Z' },   // bacino
  { k: 'ellipse', cx: 25, cy: 93, rx: 3.5, ry: 4 },    // mano sx
  { k: 'ellipse', cx: 85, cy: 93, rx: 3.5, ry: 4 },    // mano dx
  { k: 'ellipse', cx: 48, cy: 140, rx: 5, ry: 4 },     // ginocchio sx
  { k: 'ellipse', cx: 62, cy: 140, rx: 5, ry: 4 },     // ginocchio dx
  { k: 'rect', x: 43, y: 146, w: 10, h: 32, r: 5 },    // tibia sx
  { k: 'rect', x: 57, y: 146, w: 10, h: 32, r: 5 },    // tibia dx
  { k: 'rect', x: 42, y: 180, w: 12, h: 5, r: 2 },     // piede sx
  { k: 'rect', x: 56, y: 180, w: 12, h: 5, r: 2 },     // piede dx
  // — retro (cx 165) —
  { k: 'ellipse', cx: 165, cy: 15, rx: 9, ry: 10 },
  { k: 'rect', x: 161, y: 24, w: 8, h: 7, r: 2 },
  { k: 'ellipse', cx: 135, cy: 93, rx: 3.5, ry: 4 },
  { k: 'ellipse', cx: 195, cy: 93, rx: 3.5, ry: 4 },
  { k: 'ellipse', cx: 158, cy: 138, rx: 5, ry: 3.5 },
  { k: 'ellipse', cx: 172, cy: 138, rx: 5, ry: 3.5 },
  { k: 'rect', x: 152, y: 176, w: 12, h: 5, r: 2 },
  { k: 'rect', x: 166, y: 176, w: 12, h: 5, r: 2 },
];

const REGIONS: { id: RegionId; shapes: Shape[] }[] = [
  // — fronte —
  { id: 'shoulders', shapes: [
    { k: 'ellipse', cx: 36, cy: 38, rx: 8, ry: 6.5 },
    { k: 'ellipse', cx: 74, cy: 38, rx: 8, ry: 6.5 },
  ] },
  { id: 'chest', shapes: [
    { k: 'rect', x: 42, y: 34, w: 12.5, h: 16, r: 4 },
    { k: 'rect', x: 55.5, y: 34, w: 12.5, h: 16, r: 4 },
  ] },
  { id: 'abs', shapes: [{ k: 'rect', x: 45, y: 52, w: 20, h: 27, r: 5 }] },
  { id: 'biceps', shapes: [
    { k: 'rect', x: 27, y: 46, w: 9, h: 19, r: 4.5 },
    { k: 'rect', x: 74, y: 46, w: 9, h: 19, r: 4.5 },
  ] },
  { id: 'forearms', shapes: [
    { k: 'rect', x: 24, y: 67, w: 8, h: 21, r: 4 },
    { k: 'rect', x: 78, y: 67, w: 8, h: 21, r: 4 },
    // retro
    { k: 'rect', x: 134, y: 67, w: 8, h: 21, r: 4 },
    { k: 'rect', x: 188, y: 67, w: 8, h: 21, r: 4 },
  ] },
  { id: 'quads', shapes: [
    { k: 'rect', x: 42, y: 95, w: 12, h: 41, r: 6 },
    { k: 'rect', x: 56, y: 95, w: 12, h: 41, r: 6 },
  ] },
  // — retro —
  { id: 'traps', shapes: [{ k: 'path', d: 'M150 31 L180 31 L170 43 L160 43 Z' }] },
  { id: 'back', shapes: [{ k: 'path', d: 'M150 45 L180 45 L176 74 L154 74 Z' }] },
  { id: 'triceps', shapes: [
    { k: 'rect', x: 137, y: 46, w: 9, h: 19, r: 4.5 },
    { k: 'rect', x: 184, y: 46, w: 9, h: 19, r: 4.5 },
  ] },
  { id: 'glutes', shapes: [
    { k: 'rect', x: 151, y: 76, w: 13, h: 14, r: 6 },
    { k: 'rect', x: 166, y: 76, w: 13, h: 14, r: 6 },
  ] },
  { id: 'hamstrings', shapes: [
    { k: 'rect', x: 152, y: 92, w: 12, h: 38, r: 6 },
    { k: 'rect', x: 166, y: 92, w: 12, h: 38, r: 6 },
  ] },
  { id: 'calves', shapes: [
    { k: 'rect', x: 153, y: 143, w: 10, h: 28, r: 5 },
    { k: 'rect', x: 167, y: 143, w: 10, h: 28, r: 5 },
  ] },
];

function ShapeEl({ s }: { s: Shape }) {
  if (s.k === 'rect') return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} />;
  if (s.k === 'ellipse') return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} />;
  return <path d={s.d} />;
}

export function BodyMapSvg({ fills }: { fills: Partial<Record<RegionId, RegionFill>> }) {
  return (
    <svg viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Mappa recupero muscolare" style="width:100%;max-width:340px;display:block;margin:0 auto">
      <g fill="color-mix(in srgb, var(--text2) 14%, transparent)"
        stroke="color-mix(in srgb, var(--text2) 30%, transparent)" stroke-width="0.6">
        {NEUTRAL.map((s, i) => <ShapeEl key={i} s={s} />)}
      </g>
      {REGIONS.map(({ id, shapes }) => {
        const f = fills[id];
        return (
          <g
            key={id}
            data-region={id}
            fill={f?.color ? f.color : 'color-mix(in srgb, var(--text2) 14%, transparent)'}
            fill-opacity={f?.color ? f.opacity : 1}
            stroke="color-mix(in srgb, var(--text2) 30%, transparent)"
            stroke-width="0.6"
          >
            {f?.title && <title>{f.title}</title>}
            {shapes.map((s, i) => <ShapeEl key={i} s={s} />)}
          </g>
        );
      })}
      <text x="55" y="196" text-anchor="middle"
        style="font-family:var(--font-mono,monospace);font-size:7px;letter-spacing:.12em"
        fill="var(--text2)">FRONTE</text>
      <text x="165" y="196" text-anchor="middle"
        style="font-family:var(--font-mono,monospace);font-size:7px;letter-spacing:.12em"
        fill="var(--text2)">RETRO</text>
    </svg>
  );
}
