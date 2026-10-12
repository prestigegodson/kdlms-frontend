import { categorizePlugin } from "./categorize";
import { diagramLabelPlugin } from "./diagramLabel";
import { hotspotPlugin } from "./hotspot";
import { matchingPlugin } from "./matching";
import { sequencePlugin } from "./sequence";
import type { AnyInteractionPlugin } from "./types";

/**
 * Every interactive question type, keyed by its `QuestionType` (interaction-quiz.md §4.2). The
 * editor and runner treat any type not listed here as one of the original three.
 */
const PLUGINS: ReadonlyMap<string, AnyInteractionPlugin> = new Map(
  (
    [sequencePlugin, categorizePlugin, matchingPlugin, diagramLabelPlugin, hotspotPlugin] as AnyInteractionPlugin[]
  ).map((plugin) => [plugin.type, plugin]),
);

export function pluginFor(type: string): AnyInteractionPlugin | undefined {
  return PLUGINS.get(type);
}

export function isInteractive(type: string): boolean {
  return PLUGINS.has(type);
}

export function interactionPlugins(): AnyInteractionPlugin[] {
  return [...PLUGINS.values()];
}
