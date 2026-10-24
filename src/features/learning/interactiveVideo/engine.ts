import type { InteractiveItem, InteractiveItemType } from "@/api/learning";

/**
 * The interactive video player's rules as pure functions over the overlay document and the
 * session's answers - kept out of the React tree so every gating/resume/completion edge case is
 * unit-testable (engine.test.ts). Practice only: `outcomes` lives for one page visit and is never
 * sent anywhere, so a reload starts every item afresh.
 */

/**
 * What the student did with an item this session - `correct`/`wrong` only for a graded type.
 * `skipped` is a mandatory item a teacher-authored jump (adaptivity, go-to, hotspot, crossroads)
 * carried the student past: the author chose that path, so it never blocks them.
 */
export type ItemOutcome = "answered" | "correct" | "wrong" | "skipped";
export type Outcomes = Readonly<Record<string, ItemOutcome>>;

/** How far past an item's end the playhead may drift (one poll/timeupdate tick) before it counts as having played through. */
export const END_SLACK_SECONDS = 0.35;
/** Matches the backend's `InteractiveVideo.END_TOLERANCE_SECONDS` - durations are whole seconds. */
export const DURATION_TOLERANCE_SECONDS = 1;

const GRADED: ReadonlySet<InteractiveItemType> = new Set([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "FILL_BLANKS",
]);
const INTERACTIVE: ReadonlySet<InteractiveItemType> = new Set([
  ...GRADED,
  "FREE_TEXT",
  "CROSSROADS",
  "NAV_HOTSPOT",
]);

export function isGraded(type: InteractiveItemType): boolean {
  return GRADED.has(type);
}

/** Anything a student acts on - the types that may be made mandatory. */
export function isInteractive(type: InteractiveItemType): boolean {
  return INTERACTIVE.has(type);
}

/** The items on screen at `time`, in document order (later items draw on top). */
export function activeItems(items: readonly InteractiveItem[], time: number): InteractiveItem[] {
  return items.filter((item) => time >= item.start && time < item.end);
}

/** Whether `item`'s mandatory rule is satisfied by `outcomes` - always true for a non-mandatory item. */
export function isPassed(item: InteractiveItem, outcomes: Outcomes): boolean {
  const outcome = outcomes[item.id];
  switch (item.mandatory) {
    case "NONE":
      return true;
    case "ANSWERED":
      return outcome !== undefined;
    case "CORRECT":
      return outcome === "correct" || outcome === "skipped";
  }
}

/**
 * The earliest-starting mandatory item not yet passed that starts at or before `time` - what
 * blocks the student from going past it. `null` when nothing does.
 */
export function firstBlocking(items: readonly InteractiveItem[], outcomes: Outcomes, time: number): InteractiveItem | null {
  let blocker: InteractiveItem | null = null;
  for (const item of items) {
    if (item.mandatory === "NONE" || item.start > time || isPassed(item, outcomes)) {
      continue;
    }
    if (blocker === null || item.start < blocker.start) {
      blocker = item;
    }
  }
  return blocker;
}

/**
 * Where a seek from `from` to `target` actually lands: a backward seek always lands; a forward
 * one stops at the start of the first unpassed mandatory item it would skip over. A seek back
 * over an already-passed item never un-passes it.
 */
export function clampSeek(items: readonly InteractiveItem[], outcomes: Outcomes, from: number, target: number): number {
  if (target <= from) {
    return target;
  }
  const blocker = firstBlocking(items, outcomes, target);
  if (blocker && blocker.start < target) {
    return Math.max(blocker.start, Math.min(from, target));
  }
  return target;
}

/**
 * The unpassed mandatory item whose display window the playhead has just played through - the
 * video must pause at its end until it's passed. `null` when playback may continue.
 */
export function gateAt(items: readonly InteractiveItem[], outcomes: Outcomes, time: number): InteractiveItem | null {
  const blocker = firstBlocking(items, outcomes, time);
  return blocker && time >= blocker.end - END_SLACK_SECONDS ? blocker : null;
}

/** Where the gate holds the playhead - just inside the item's window, so it stays on screen. */
export function gateHoldTime(item: InteractiveItem): number {
  return Math.max(item.start, item.end - END_SLACK_SECONDS);
}

/**
 * Where a returning student resumes: answers aren't saved, so every mandatory item before the
 * saved position is unpassed again - resume at the earliest of those, else at `saved`.
 */
export function resumePoint(items: readonly InteractiveItem[], saved: number | null | undefined): number {
  const position = saved && saved > 0 ? saved : 0;
  const blocker = firstBlocking(items, {}, position);
  return blocker && blocker.start < position ? blocker.start : position;
}

/**
 * The pausing items whose start the playhead crossed going from `previous` to `time` during normal
 * playback - each pauses the video once as it appears. A jump (seek) is not a crossing.
 */
export function crossedPauses(
  items: readonly InteractiveItem[],
  previous: number,
  time: number,
  alreadyPaused: ReadonlySet<string>,
): InteractiveItem[] {
  if (time < previous) {
    return [];
  }
  return items.filter(
    (item) => item.pause && !alreadyPaused.has(item.id) && item.start > previous - 0.001 && item.start <= time,
  );
}

/**
 * `outcomes` plus a `skipped` mark on every unpassed mandatory item an authored jump from `from`
 * forward to `to` carries the student over (those starting in `(from, to]`). A backward jump waives nothing.
 */
export function waiveJumpedOver(
  items: readonly InteractiveItem[],
  outcomes: Outcomes,
  from: number,
  to: number,
): Outcomes {
  if (to <= from) {
    return outcomes;
  }
  const next: Record<string, ItemOutcome> = { ...outcomes };
  for (const item of items) {
    if (item.mandatory !== "NONE" && item.start > from && item.start <= to && !isPassed(item, outcomes)) {
      next[item.id] = "skipped";
    }
  }
  return next;
}

/** Done once the video has played to its end with every mandatory item passed. */
export function isComplete(items: readonly InteractiveItem[], outcomes: Outcomes): boolean {
  return items.every((item) => isPassed(item, outcomes));
}

/** The ids of items (or their jump targets) that fall past a video `duration` seconds long. */
export function outOfRangeIds(items: readonly InteractiveItem[], duration: number | null): Set<string> {
  const ids = new Set<string>();
  if (duration == null) {
    return ids;
  }
  const limit = duration + DURATION_TOLERANCE_SECONDS;
  for (const item of items) {
    const targets = [
      item.goTo?.kind === "TIME" ? item.goTo.seconds : null,
      item.adaptivity?.onCorrectSeconds ?? null,
      item.adaptivity?.onWrongSeconds ?? null,
      item.content.targetSeconds,
      ...(item.content.choices ?? []).map((choice) => choice.targetSeconds),
    ];
    if (item.end > limit || targets.some((target) => target != null && target > limit)) {
      ids.add(item.id);
    }
  }
  return ids;
}

/** `m:ss` (or `h:mm:ss`) for a seconds offset - the editor's and control bar's time format. */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Parses `m:ss`, `h:mm:ss` or plain seconds; `null` when it isn't a time. */
export function parseTimecode(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parts = trimmed.split(":");
  if (parts.length > 3 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) {
    return null;
  }
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}
