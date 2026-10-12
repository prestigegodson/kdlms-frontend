import { X } from "lucide-react";
import { useCallback } from "react";
import { RichContent } from "@/components/richText/RichContent";
import { DragLayer } from "../shared/DragLayer";
import { Draggable } from "../shared/Draggable";
import { Droppable } from "../shared/Droppable";
import { describeLabel } from "../shared/labels";
import { LiveAnnouncer } from "../shared/LiveAnnouncer";
import type { RenderImage } from "../types";
import type { MatchingPlayerConfig, MatchingResponse } from "./types";

interface MatchingPlayerProps {
  config: MatchingPlayerConfig;
  value: MatchingResponse | null;
  onChange(response: MatchingResponse): void;
  disabled: boolean;
  renderImage?: RenderImage;
}

/**
 * Pairs each prompt with an answer (interaction-quiz.md §7): drag an answer from the bank onto a
 * prompt's slot, or tap (Enter/Space) the answer and then the slot. A placed answer can be cleared;
 * placing another replaces it. Unless answers may be reused, one already placed leaves the bank.
 */
export function MatchingPlayer({ config, value, onChange, disabled, renderImage }: MatchingPlayerProps) {
  const pairs = value?.pairs ?? {};
  const leftIds = new Set(config.lefts.map((left) => left.id));
  const rightsById = new Map(config.rights.map((right) => [right.id, right]));
  const used = new Set(Object.values(pairs));
  const bank = config.reuseRights ? config.rights : config.rights.filter((right) => !used.has(right.id));

  const describe = useCallback(
    (id: string) => {
      const leftIndex = config.lefts.findIndex((left) => left.id === id);
      if (leftIndex >= 0) {
        return `the answer for ${describeLabel(config.lefts[leftIndex].html, `prompt ${leftIndex + 1}`)}`;
      }
      const rightIndex = config.rights.findIndex((right) => right.id === id);
      return describeLabel(config.rights[rightIndex]?.html ?? "", `Answer ${rightIndex + 1}`);
    },
    [config],
  );

  function place(rightId: string, leftId: string) {
    if (!leftIds.has(leftId) || !rightsById.has(rightId)) {
      return;
    }
    onChange({ pairs: { ...pairs, [leftId]: rightId } });
  }

  function clear(leftId: string) {
    const next = { ...pairs };
    delete next[leftId];
    onChange({ pairs: next });
  }

  return (
    <LiveAnnouncer>
      <DragLayer onPlace={place} describe={describe} disabled={disabled}>
        <div className="space-y-4">
          <ul className="space-y-2" aria-label="Prompts">
            {config.lefts.map((left, index) => {
              const placed = pairs[left.id] ? rightsById.get(pairs[left.id]) : undefined;
              const leftText = describeLabel(left.html, `Prompt ${index + 1}`);
              return (
                <li key={left.id} className="grid items-center gap-2 sm:grid-cols-2">
                  <RichContent html={left.html} renderImage={renderImage} className="min-w-0 break-words font-medium" />
                  <div className="flex items-center gap-1">
                    <Droppable id={left.id} label={`Answer for ${leftText}`} className="flex-1">
                      {placed ? (
                        <RichContent html={placed.html} renderImage={renderImage} className="min-w-0 break-words" />
                      ) : (
                        <span className="text-sm text-slate-400">Drop an answer here</span>
                      )}
                    </Droppable>
                    {placed && !disabled && (
                      <button
                        type="button"
                        aria-label={`Clear the answer for ${leftText}`}
                        onClick={() => clear(left.id)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div>
            <p className="mb-2 text-sm text-slate-600">
              Answers - drag one onto a prompt, or tap it and then the prompt&apos;s slot.
            </p>
            {bank.length === 0 ? (
              <p className="text-sm text-slate-400">Every answer has been placed.</p>
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label="Answers">
                {bank.map((right) => (
                  <li key={right.id}>
                    <Draggable id={right.id}>
                      <RichContent html={right.html} renderImage={renderImage} className="break-words" />
                    </Draggable>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DragLayer>
    </LiveAnnouncer>
  );
}
