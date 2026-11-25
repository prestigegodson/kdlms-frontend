import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Clock,
  LogOut,
  RotateCcw,
  Timer,
  Users,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { initialsOfFullName } from "@/utils/initials";
import {
  dateInZone,
  formatCallDuration,
  longDate,
  minutesBetween,
  timeInZone,
} from "../scheduleUtils";

export type LessonEndedTone = "complete" | "left" | "cancelled" | "problem";

export interface LessonEndedViewProps {
  className: string;
  /** The other side - the tutor for a learner or guardian, the learner for the tutor. */
  peerName: string | null;
  peerRole: "tutor" | "learner" | null;
  scheduledStart: string;
  scheduledEnd: string;
  mode: "direct" | "group";
  /** A guardian watched rather than took part. */
  watched: boolean;
  tone: LessonEndedTone;
  title: string;
  message: string;
  /** How long this side was actually in the call; null when it never connected. */
  durationMs: number | null;
  home: string;
  onRejoin?: () => void;
}

const TONE_STYLE: Record<LessonEndedTone, { icon: typeof CheckCircle2; ring: string; color: string }> = {
  complete: { icon: CheckCircle2, ring: "bg-brand-50 ring-brand-100", color: "text-brand-500" },
  left: { icon: LogOut, ring: "bg-slate-100 ring-slate-200", color: "text-slate-600" },
  cancelled: { icon: CalendarX, ring: "bg-slate-100 ring-slate-200", color: "text-slate-600" },
  problem: { icon: AlertCircle, ring: "bg-amber-50 ring-amber-100", color: "text-amber-600" },
};

function viewerZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * The screen a virtual-class call lands on once it's over: what happened, the lesson's details
 * (class, who it was with, when, how long this side was in it), and where to go next.
 */
export function LessonEndedView({
  className,
  peerName,
  peerRole,
  scheduledStart,
  scheduledEnd,
  mode,
  watched,
  tone,
  title,
  message,
  durationMs,
  home,
  onRejoin,
}: LessonEndedViewProps) {
  const navigate = useNavigate();
  const zone = viewerZone();
  const style = TONE_STYLE[tone];
  const Icon = style.icon;
  const scheduledMinutes = minutesBetween(scheduledStart, scheduledEnd);

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <section
          aria-labelledby="lesson-ended-title"
          className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-8 text-center">
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full ring-8 ${style.ring}`}
            >
              <Icon className={`h-8 w-8 ${style.color}`} aria-hidden="true" />
            </span>
            <h1
              id="lesson-ended-title"
              className="mt-2 font-display text-2xl font-medium text-slate-900"
            >
              {title}
            </h1>
            <p className="text-sm text-slate-600">{message}</p>
          </div>

          <div className="border-t border-slate-200 px-6 py-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Class details
            </h2>
            {peerName && (
              <div className="mb-4 flex items-center gap-3">
                <Avatar initials={initialsOfFullName(peerName)} url={null} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{peerName}</p>
                  {peerRole && (
                    <p className="text-xs text-slate-500">
                      {peerRole === "tutor" ? "Tutor" : "Learner"}
                    </p>
                  )}
                </div>
              </div>
            )}
            <dl className="divide-y divide-slate-100 rounded-control border border-slate-200">
              <DetailRow icon={<BookOpen className="h-4 w-4" />} label="Class">
                {className}
              </DetailRow>
              <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Date">
                {longDate(dateInZone(scheduledStart, zone))}
              </DetailRow>
              <DetailRow icon={<Clock className="h-4 w-4" />} label="Scheduled">
                {timeInZone(scheduledStart, zone)} – {timeInZone(scheduledEnd, zone)}
                {scheduledMinutes > 0 && (
                  <span className="text-slate-500"> · {scheduledMinutes} min</span>
                )}
              </DetailRow>
              {durationMs !== null && (
                <DetailRow icon={<Timer className="h-4 w-4" />} label="Time in call">
                  {formatCallDuration(durationMs)}
                </DetailRow>
              )}
              <DetailRow
                icon={
                  mode === "direct" ? <Video className="h-4 w-4" /> : <Users className="h-4 w-4" />
                }
                label="Type"
              >
                <span className="inline-flex flex-wrap items-center justify-end gap-2">
                  {mode === "direct" ? "One-on-one video" : "Group live session"}
                  {watched && <Badge variant="info">Watched</Badge>}
                </span>
              </DetailRow>
            </dl>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant={onRejoin ? "secondary" : "primary"}
              onClick={() => navigate(home)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
            </Button>
            {onRejoin && (
              <Button type="button" onClick={onRejoin}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Rejoin
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <dt className="flex shrink-0 items-center gap-2 text-slate-500">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="min-w-0 text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}
