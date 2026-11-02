import { describe, expect, it } from "vitest";
import type { WardTermView } from "@/api/wards";
import { latestPublished, orderTerms, pastResultGroups } from "@/features/guardian/wardResultHistory";

function term(overrides: Partial<WardTermView> & Pick<WardTermView, "termId">): WardTermView {
  return {
    sessionId: "sess-2026",
    sessionName: "2026/2027",
    currentSession: true,
    termName: "First Term",
    termNumber: 1,
    classId: "class-1",
    className: "Primary 4",
    resultsPublished: false,
    midtermPublished: false,
    ...overrides,
  };
}

const PAST_SESSION = { sessionId: "sess-2025", sessionName: "2025/2026", currentSession: false, className: "Primary 3" };
const OLDER_SESSION = { sessionId: "sess-2024", sessionName: "2024/2025", currentSession: false, className: "Primary 2" };

describe("orderTerms", () => {
  it("puts the current session first, then sessions newest-first, then terms highest-number-first", () => {
    const terms = [
      term({ termId: "old-1", ...OLDER_SESSION, termNumber: 1 }),
      term({ termId: "cur-1", termNumber: 1 }),
      term({ termId: "past-3", ...PAST_SESSION, termNumber: 3 }),
      term({ termId: "cur-2", termNumber: 2 }),
      term({ termId: "past-1", ...PAST_SESSION, termNumber: 1 }),
    ];

    expect(orderTerms(terms).map((t) => t.termId)).toEqual(["cur-2", "cur-1", "past-3", "past-1", "old-1"]);
  });
});

describe("latestPublished", () => {
  it("returns null when nothing has been published", () => {
    expect(latestPublished([term({ termId: "cur-1" })])).toBeNull();
    expect(latestPublished([])).toBeNull();
  });

  it("skips newer unpublished terms and picks the newest term with anything published", () => {
    const latest = latestPublished([
      term({ termId: "cur-2", termNumber: 2 }),
      term({ termId: "cur-1", termNumber: 1, resultsPublished: true }),
      term({ termId: "past-3", ...PAST_SESSION, termNumber: 3, resultsPublished: true }),
    ]);

    expect(latest).toEqual({ term: expect.objectContaining({ termId: "cur-1" }), scope: "TERM" });
  });

  it("prefers the end-of-term result over the mid-term one within the same term", () => {
    const latest = latestPublished([term({ termId: "cur-1", resultsPublished: true, midtermPublished: true })]);

    expect(latest?.scope).toBe("TERM");
  });

  it("returns the mid-term result when it is the newest thing published", () => {
    const latest = latestPublished([
      term({ termId: "cur-2", termNumber: 2, midtermPublished: true }),
      term({ termId: "cur-1", termNumber: 1, resultsPublished: true, midtermPublished: true }),
    ]);

    expect(latest).toEqual({ term: expect.objectContaining({ termId: "cur-2" }), scope: "MIDTERM" });
  });
});

describe("pastResultGroups", () => {
  it("leaves out the latest result but keeps the same term's other published scope", () => {
    const terms = [term({ termId: "cur-1", resultsPublished: true, midtermPublished: true })];

    const groups = pastResultGroups(terms, latestPublished(terms));

    expect(groups).toHaveLength(1);
    expect(groups[0].terms).toEqual([{ term: terms[0], endOfTerm: false, midterm: true }]);
  });

  it("drops a term whose only published result is the latest one", () => {
    const terms = [
      term({ termId: "cur-1", resultsPublished: true }),
      term({ termId: "past-3", ...PAST_SESSION, termNumber: 3, resultsPublished: true }),
    ];

    const groups = pastResultGroups(terms, latestPublished(terms));

    expect(groups.map((g) => g.sessionId)).toEqual(["sess-2025"]);
    expect(groups[0].terms.map((row) => row.term.termId)).toEqual(["past-3"]);
  });

  it("keeps never-published terms as muted rows and groups by session newest-first", () => {
    const terms = [
      term({ termId: "old-1", ...OLDER_SESSION, resultsPublished: true }),
      term({ termId: "cur-2", termNumber: 2 }),
      term({ termId: "cur-1", termNumber: 1, midtermPublished: true }),
    ];

    const groups = pastResultGroups(terms, latestPublished(terms));

    expect(groups.map((g) => [g.sessionName, g.className, g.terms.map((row) => row.term.termId)])).toEqual([
      ["2026/2027", "Primary 4", ["cur-2"]],
      ["2024/2025", "Primary 2", ["old-1"]],
    ]);
    expect(groups[0].terms[0]).toMatchObject({ endOfTerm: false, midterm: false });
  });

  it("lists every term when there is no latest result", () => {
    const terms = [term({ termId: "cur-1" })];

    expect(pastResultGroups(terms, null)[0].terms).toHaveLength(1);
  });
});
