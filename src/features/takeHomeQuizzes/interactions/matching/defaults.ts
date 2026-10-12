import { BLANK_LABEL } from "../shared/labels";
import { shuffleAwayFromOrder } from "../shared/shuffle";
import type { MatchingConfig, MatchingLeft, MatchingPlayerConfig, MatchingRight } from "./types";

export function blankMatchingRight(): MatchingRight {
  return { id: crypto.randomUUID(), html: BLANK_LABEL };
}

export function blankMatchingLeft(rightId: string | null = null): MatchingLeft {
  return { id: crypto.randomUUID(), html: BLANK_LABEL, rightId };
}

/** Two empty pairs - the fewest a matching question can be published with. */
export function blankMatching(): MatchingConfig {
  const rights = [blankMatchingRight(), blankMatchingRight()];
  return {
    schemaVersion: 1,
    lefts: rights.map((right) => blankMatchingLeft(right.id)),
    rights,
    reuseRights: false,
  };
}

/** Pairings dropped and rights shuffled - what the server would send a student. */
export function toMatchingPlayerView(config: MatchingConfig): MatchingPlayerConfig {
  return {
    lefts: config.lefts.map(({ id, html }) => ({ id, html })),
    rights: shuffleAwayFromOrder(config.rights.map(({ id, html }) => ({ id, html }))),
    reuseRights: config.reuseRights,
  };
}
