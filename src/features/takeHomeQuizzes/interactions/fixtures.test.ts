import { describe, expect, it } from "vitest";
import type { PartFeedback, ScoreResult, ScoringMode } from "./types";
import { scoreCategorize } from "./categorize/score";
import { scoreDiagramLabel } from "./diagramLabel/score";
import { scoreHotspot } from "./hotspot/score";
import { scoreMatching } from "./matching/score";
import { scoreSequence } from "./sequence/score";
import { scoreFromParts } from "./shared/scoring";

/**
 * The golden fixtures shared with the backend (interaction-quiz.md §4.2) - the same files
 * `InteractionFixtureParityTest` scores with each server plugin, so the authoring preview's TS
 * scorer can't drift from the authoritative one. Each real type adds its folder's scorer to
 * `SCORERS` as it lands; `_stub` proves the harness itself.
 */
interface Fixture {
  description: string;
  config: unknown;
  response: unknown;
  points: string;
  scoring: ScoringMode;
  expected: { awarded: string; parts: { partId: string; correct: boolean }[] };
}

type Scorer = (config: never, response: never, points: number, mode: ScoringMode) => ScoreResult;

const FIXTURES = import.meta.glob<Fixture>(
  "../../../../../backend/src/test/resources/interaction-fixtures/*/*.json",
  { eager: true, import: "default" },
);

/** The backend's test-only `StubInteractionType`: order `answer`'s items, one part per position. */
function scoreStub(
  config: { answer: string[] },
  response: { given: string[] } | null,
  points: number,
  mode: ScoringMode,
): ScoreResult {
  const given = [
    ...new Set((response?.given ?? []).filter((item) => config.answer.includes(item))),
  ];
  const parts: PartFeedback[] = config.answer.map((expected, i) => ({
    partId: `p${i}`,
    correct: given[i] === expected,
    expectedRef: expected,
    givenRef: given[i] ?? null,
  }));
  return scoreFromParts(points, mode, parts);
}

const SCORERS: Record<string, Scorer> = {
  _stub: scoreStub as Scorer,
  sequence: scoreSequence as Scorer,
  matching: scoreMatching as Scorer,
  categorize: scoreCategorize as Scorer,
  diagram_label: scoreDiagramLabel as Scorer,
  hotspot: scoreHotspot as Scorer,
};

const cases = Object.entries(FIXTURES).map(([path, fixture]) => {
  const [dir, file] = path.split("/").slice(-2);
  return { dir, name: `${dir}/${file}: ${fixture.description}`, fixture };
});

describe("interaction golden fixtures", () => {
  it("finds the shared fixtures", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it("has a scorer for every fixture folder", () => {
    expect([...new Set(cases.map(({ dir }) => dir))].filter((dir) => !(dir in SCORERS))).toEqual(
      [],
    );
  });

  it.each(cases)("$name", ({ dir, fixture }) => {
    const score = SCORERS[dir](
      fixture.config as never,
      fixture.response as never,
      Number(fixture.points),
      fixture.scoring,
    );

    expect(score.awarded).toBe(Number(fixture.expected.awarded));
    expect(score.parts.map(({ partId, correct }) => ({ partId, correct }))).toEqual(
      fixture.expected.parts,
    );
  });
});
