import { BLANK_LABEL } from "../shared/labels";
import { shuffleAwayFromOrder } from "../shared/shuffle";
import type { SequenceConfig, SequenceItem, SequencePlayerConfig } from "./types";

export function blankSequenceItem(): SequenceItem {
  return { id: crypto.randomUUID(), html: BLANK_LABEL, caption: null };
}

/** Three empty items - the fewest a sequence can be published with. */
export function blankSequence(): SequenceConfig {
  return {
    schemaVersion: 1,
    presentation: "LIST",
    items: [blankSequenceItem(), blankSequenceItem(), blankSequenceItem()],
  };
}

/** Captions dropped and items shuffled out of order - what the server would send a student. */
export function toSequencePlayerView(config: SequenceConfig): SequencePlayerConfig {
  return {
    presentation: config.presentation,
    items: shuffleAwayFromOrder(config.items.map(({ id, html }) => ({ id, html }))),
  };
}
