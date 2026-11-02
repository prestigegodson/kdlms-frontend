interface ProgressBarProps {
  percent: number;
  label: string;
  /** `accent` is the screen's single amber element - use it once. */
  tone?: "brand" | "accent";
  className?: string;
}

/** A thin horizontal meter - the `SubjectClassesCard` pattern, as a reusable piece for the student Home. */
export function ProgressBar({ percent, label, tone = "brand", className = "" }: ProgressBarProps) {
  const fill = tone === "accent" ? "bg-accent-500" : "bg-brand-500";
  return (
    <span className={`block h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <span
        className={`block h-full rounded-full ${fill}`}
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </span>
  );
}
