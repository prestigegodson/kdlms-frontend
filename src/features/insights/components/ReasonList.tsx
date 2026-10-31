import type { RiskReason } from "@/api/insights";
import { SIGNAL_LABEL } from "@/features/insights/format";

/** A chip per fired signal plus its full server-authored sentence - never the chip alone. */
export function ReasonList({ reasons }: { reasons: RiskReason[] }) {
  if (reasons.length === 0) {
    return <span className="text-sm text-slate-500">No signals fired</span>;
  }
  return (
    <ul className="space-y-1.5">
      {reasons.map((reason) => (
        <li key={reason.signal} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {SIGNAL_LABEL[reason.signal] ?? reason.signal}
          </span>
          <span className="text-sm text-slate-700">{reason.message}</span>
        </li>
      ))}
    </ul>
  );
}
