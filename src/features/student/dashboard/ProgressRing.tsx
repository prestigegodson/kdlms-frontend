interface ProgressRingProps {
  percent: number;
  label: string;
  size?: number;
}

const STROKE = 6;

/** A circular percentage gauge in plain SVG - no chart library, so it renders on the oldest supported tablets. */
export function ProgressRing({ percent, label, size = 64 }: ProgressRingProps) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={STROKE} className="stroke-slate-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="stroke-brand-500"
        />
      </svg>
      <span className="absolute left-0 top-0 flex h-full w-full items-center justify-center font-display text-sm font-medium tabular-nums text-slate-900">
        {percent}%
      </span>
    </div>
  );
}
