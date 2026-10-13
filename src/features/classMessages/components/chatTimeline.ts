import type { MessageView } from "@/api/communication";

/** Consecutive messages from one author closer together than this share one avatar and name. */
const GROUP_GAP_MS = 5 * 60 * 1000;

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const FULL = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / 86_400_000);
}

/** A day separator's label: "Today", "Yesterday", "Mon 12 Oct", or with the year once it's another year. */
export function dayLabel(date: Date, now: Date = new Date()): string {
  const days = daysBetween(date, now);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.getFullYear() === now.getFullYear() ? WEEKDAY_DAY_MONTH.format(date) : FULL.format(date);
}

/** A conversation list row's time: the clock today, "Yesterday", else the day and month. */
export function listTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = daysBetween(date, now);
  if (days === 0) return TIME.format(date);
  if (days === 1) return "Yesterday";
  return date.getFullYear() === now.getFullYear() ? DAY_MONTH.format(date) : FULL.format(date);
}

/** The time printed under a bubble. */
export function bubbleTime(iso: string): string {
  return TIME.format(new Date(iso));
}

export interface DayGroup {
  key: string;
  date: Date;
  messages: MessageView[];
}

/** Splits a chronological message list into one run per local calendar day, keeping the order. */
export function groupByDay(messages: MessageView[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const message of messages) {
    const date = new Date(message.createdAt);
    const key = String(startOfDay(date));
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.messages.push(message);
    } else {
      groups.push({ key, date, messages: [message] });
    }
  }
  return groups;
}

/**
 * Whether `next` continues `previous`'s run - same author, same kind (an announcement always stands
 * alone), and close enough in time.
 */
export function continuesRun(previous: MessageView | undefined, next: MessageView | undefined): boolean {
  if (!previous || !next) return false;
  return (
    previous.authorId === next.authorId &&
    !previous.announcement &&
    !next.announcement &&
    Math.abs(new Date(next.createdAt).getTime() - new Date(previous.createdAt).getTime()) < GROUP_GAP_MS
  );
}
