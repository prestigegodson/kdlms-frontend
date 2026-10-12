import { BLANK_LABEL } from "../shared/labels";
import { shuffleAwayFromOrder } from "../shared/shuffle";
import type { CategorizeConfig, CategorizeGroup, CategorizeItem, CategorizePlayerConfig } from "./types";

export function blankCategorizeGroup(): CategorizeGroup {
  return { id: crypto.randomUUID(), html: BLANK_LABEL };
}

export function blankCategorizeItem(groupId: string | null = null): CategorizeItem {
  return { id: crypto.randomUUID(), html: BLANK_LABEL, groupId };
}

/** Two groups of two items - the fewest a categorize question can be published with. */
export function blankCategorize(): CategorizeConfig {
  const groups = [blankCategorizeGroup(), blankCategorizeGroup()];
  return {
    schemaVersion: 1,
    groups,
    items: [0, 1, 0, 1].map((index) => blankCategorizeItem(groups[index].id)),
  };
}

/** Every item's group dropped and both lists shuffled - what the server would send a student. */
export function toCategorizePlayerView(config: CategorizeConfig): CategorizePlayerConfig {
  return {
    groups: shuffleAwayFromOrder(config.groups.map(({ id, html }) => ({ id, html }))),
    items: shuffleAwayFromOrder(config.items.map(({ id, html }) => ({ id, html }))),
  };
}
