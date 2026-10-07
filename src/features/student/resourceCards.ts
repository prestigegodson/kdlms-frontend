import type { MyLearningResourceSummaryView, MyResourceCardKind } from "@/api/learning";
import { formatInstantDate } from "@/utils/date";
import { formatDuration } from "@/utils/duration";

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  PDF: "PDF",
  RICH_TEXT: "Note",
  YOUTUBE: "YouTube",
  AUDIO: "Audio",
  VIDEO: "Video",
};

/**
 * `resource.description`, with the media duration and (Phase 35L) an "Available until ..." hint
 * appended - e.g. "5:00 lecture · 4:32 · Available until 10 Oct 2026". The resource is simply
 * absent from the list once its window has actually closed - this is a heads-up while it's still
 * visible, never a claim the page enforces itself.
 */
export function resourceRowMeta(resource: MyLearningResourceSummaryView): string | undefined {
  const parts = [
    resource.description ?? undefined,
    formatDuration(resource.durationSeconds) || undefined,
    resource.availableUntil ? `Available until ${formatInstantDate(resource.availableUntil)}` : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** One card on the student Resources page - a subject, or a subject group its subjects roll up into (decided server-side). */
export interface ResourceCard {
  kind: MyResourceCardKind;
  id: string;
  name: string;
  resources: MyLearningResourceSummaryView[];
  notCompleted: number;
  unopened: number;
  /** The newest `visibleSince` among the card's resources, or `null` when none carries one. */
  latestVisibleSince: string | null;
}

export function cardPath(kind: MyResourceCardKind, id: string): string {
  return `/student/resources/${kind === "GROUP" ? "group" : "subject"}/${id}`;
}

/** Parsed rather than compared as strings - the server's ISO instants vary in fractional-second digits. */
function epochMillis(instant: string | null): number {
  const millis = instant ? Date.parse(instant) : Number.NaN;
  return Number.isNaN(millis) ? Number.NEGATIVE_INFINITY : millis;
}

function cardKey(kind: MyResourceCardKind, id: string): string {
  return `${kind}:${id}`;
}

/** Groups rows into cards, the card with the most recently visible resource first (ties by name). */
export function groupByCard(resources: MyLearningResourceSummaryView[]): ResourceCard[] {
  const cards = new Map<string, ResourceCard>();
  for (const resource of resources) {
    const kind = resource.cardKind ?? "SUBJECT";
    const id = resource.cardId ?? resource.subjectName;
    const key = cardKey(kind, id);
    let card = cards.get(key);
    if (!card) {
      card = {
        kind,
        id,
        name: resource.cardName ?? resource.subjectName,
        resources: [],
        notCompleted: 0,
        unopened: 0,
        latestVisibleSince: null,
      };
      cards.set(key, card);
    }
    card.resources.push(resource);
    if (!resource.completed) card.notCompleted += 1;
    if (!resource.opened) card.unopened += 1;
    const visibleSince = resource.visibleSince ?? null;
    if (visibleSince && epochMillis(visibleSince) > epochMillis(card.latestVisibleSince)) {
      card.latestVisibleSince = visibleSince;
    }
  }
  return [...cards.values()].sort((a, b) => {
    const aMillis = epochMillis(a.latestVisibleSince);
    const bMillis = epochMillis(b.latestVisibleSince);
    if (aMillis !== bMillis) return bMillis > aMillis ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

/** The resources on one card, in the teacher's own order. */
export function resourcesOnCard(
  resources: MyLearningResourceSummaryView[],
  kind: MyResourceCardKind,
  id: string,
): MyLearningResourceSummaryView[] {
  return groupByCard(resources).find((card) => card.kind === kind && card.id === id)?.resources ?? [];
}
