// Sparkline: barre mini da una serie numerica. Usa la classe .cc-spark del
// cockpit Carbon (token-driven). Estratta da Dashboard.jsx.

interface SparklineProps {
  data?: number[];
  color?: string;
}

export function Sparkline({ data = [], color = 'var(--accent)' }: SparklineProps) {
  const max = Math.max(1, ...data.map((v) => Number(v) || 0));
  return (
    <div class="cc-spark" aria-hidden="true">
      {data.map((v, i) => (
        <span
          key={i}
          style={{
            height: `${Math.max(10, ((Number(v) || 0) / max) * 100)}%`,
            background: color,
            animationDelay: `${i * 55}ms`,
          }}
        />
      ))}
    </div>
  );
}
