import type { ResultScope } from "@/api/types";
import type { WardTermView } from "@/api/wards";

/** The one result the Latest tab shows. */
export interface LatestResult {
  term: WardTermView;
  scope: ResultScope;
}

export interface PastTermRow {
  term: WardTermView;
  /** True when the end-of-term result is published and isn't the one on the Latest tab. */
  endOfTerm: boolean;
  /** True when the mid-term result is published and isn't the one on the Latest tab. */
  midterm: boolean;
}

export interface PastSessionGroup {
  sessionId: string;
  sessionName: string;
  currentSession: boolean;
  className?: string;
  terms: PastTermRow[];
}

/**
 * Newest first: the current session leads, then sessions by name descending
 * (`2025/2026` before `2024/2025`), then terms by number descending within a
 * session. The API carries no publish timestamp, so this academic order is
 * what "latest" means.
 */
export function orderTerms(terms: WardTermView[]): WardTermView[] {
  return [...terms].sort((a, b) => {
    if (a.sessionId !== b.sessionId) {
      if (a.currentSession !== b.currentSession) return a.currentSession ? -1 : 1;
      return b.sessionName.localeCompare(a.sessionName);
    }
    return b.termNumber - a.termNumber;
  });
}

/**
 * The newest term with anything published. Within that term the end-of-term
 * result wins over the mid-term one, since it supersedes it.
 */
export function latestPublished(terms: WardTermView[]): LatestResult | null {
  for (const term of orderTerms(terms)) {
    if (term.resultsPublished) return { term, scope: "TERM" };
    if (term.midtermPublished) return { term, scope: "MIDTERM" };
  }
  return null;
}

/**
 * Every term except the result already on the Latest tab, grouped by session
 * (newest first). A term that has never had anything published stays in the
 * list as a muted row so the enrolment history is still visible. A term whose
 * only published result is the latest one is dropped, because it has nothing
 * left to offer here.
 */
export function pastResultGroups(terms: WardTermView[], latest: LatestResult | null): PastSessionGroup[] {
  const groups = new Map<string, PastSessionGroup>();
  for (const term of orderTerms(terms)) {
    const isLatestTerm = latest?.term.termId === term.termId;
    const endOfTerm = term.resultsPublished && !(isLatestTerm && latest?.scope === "TERM");
    const midterm = term.midtermPublished && !(isLatestTerm && latest?.scope === "MIDTERM");
    const neverPublished = !term.resultsPublished && !term.midtermPublished;
    if (!endOfTerm && !midterm && !neverPublished) continue;

    let group = groups.get(term.sessionId);
    if (!group) {
      group = {
        sessionId: term.sessionId,
        sessionName: term.sessionName,
        currentSession: term.currentSession,
        className: term.className,
        terms: [],
      };
      groups.set(term.sessionId, group);
    }
    group.terms.push({ term, endOfTerm, midterm });
  }
  return [...groups.values()];
}
