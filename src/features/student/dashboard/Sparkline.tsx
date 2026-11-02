interface SparklineProps {
  /** Percentages 0-100, oldest first. */
  points: number[];
  label: string;
  width?: number;
  height?: number;
}

const PAD = 3;

/** A tiny trend line in plain SVG; the last point is marked so the current value reads at a glance. */
export function Sparkline({ points, label, width = 120, height = 36 }: SparklineProps) {
  if (points.length < 2) {
    return null;
  }
  const step = (width - PAD * 2) / (points.length - 1);
  const coords = points.map((value, index) => ({
    x: PAD + index * step,
    y: PAD + (1 - value / 100) * (height - PAD * 2),
  }));
  const last = coords[coords.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block">
      <polyline
        points={coords.map(({ x, y }) => `${x},${y}`).join(" ")}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-brand-400"
      />
      <circle cx={last.x} cy={last.y} r={3} className="fill-brand-600" />
    </svg>
  );
}
