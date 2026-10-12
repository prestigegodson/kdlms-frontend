import { X } from "lucide-react";
import { useCallback } from "react";
import { RichContent } from "@/components/richText/RichContent";
import { DragLayer } from "../shared/DragLayer";
import { Draggable } from "../shared/Draggable";
import { Droppable } from "../shared/Droppable";
import { describeLabel } from "../shared/labels";
import { LiveAnnouncer } from "../shared/LiveAnnouncer";
import type { RenderImage } from "../types";
import type { CategorizePlayerConfig, CategorizeResponse } from "./types";

interface CategorizePlayerProps {
  config: CategorizePlayerConfig;
  value: CategorizeResponse | null;
  onChange(response: CategorizeResponse): void;
  disabled: boolean;
  renderImage?: RenderImage;
}

/**
 * Sorts items into groups (interaction-quiz.md §7): drag an item onto a group, or tap (Enter/Space)
 * the item and then the group. A placed item can be moved to another group the same way, or sent
 * back to the items still to sort.
 */
export function CategorizePlayer({ config, value, onChange, disabled, renderImage }: CategorizePlayerProps) {
  const placements = value?.placements ?? {};
  const groupIds = new Set(config.groups.map((group) => group.id));
  const itemIds = new Set(config.items.map((item) => item.id));
  const unplaced = config.items.filter((item) => !groupIds.has(placements[item.id]));

  const describe = useCallback(
    (id: string) => {
      const groupIndex = config.groups.findIndex((group) => group.id === id);
      if (groupIndex >= 0) {
        return describeLabel(config.groups[groupIndex].html, `Group ${groupIndex + 1}`);
      }
      const itemIndex = config.items.findIndex((item) => item.id === id);
      return describeLabel(config.items[itemIndex]?.html ?? "", `Item ${itemIndex + 1}`);
    },
    [config],
  );

  function place(itemId: string, groupId: string) {
    if (!itemIds.has(itemId) || !groupIds.has(groupId)) {
      return;
    }
    onChange({ placements: { ...placements, [itemId]: groupId } });
  }

  function unplace(itemId: string) {
    const next = { ...placements };
    delete next[itemId];
    onChange({ placements: next });
  }

  return (
    <LiveAnnouncer>
      <DragLayer onPlace={place} describe={describe} disabled={disabled}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-slate-600">
              Items to sort - drag one onto a group, or tap it and then the group.
            </p>
            {unplaced.length === 0 ? (
              <p className="text-sm text-slate-400">Every item has been sorted.</p>
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label="Items to sort">
                {unplaced.map((item) => (
                  <li key={item.id}>
                    <Draggable id={item.id}>
                      <RichContent html={item.html} renderImage={renderImage} className="break-words" />
                    </Draggable>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.groups.map((group, index) => {
              const groupText = describeLabel(group.html, `Group ${index + 1}`);
              const members = config.items.filter((item) => placements[item.id] === group.id);
              return (
                <section key={group.id} className="min-w-0 rounded-card border border-slate-200 p-3">
                  <RichContent
                    html={group.html}
                    renderImage={renderImage}
                    className="mb-2 min-w-0 break-words font-semibold text-slate-800"
                  />
                  <Droppable id={group.id} label={`Group ${groupText}`} className="min-h-20">
                    {members.length === 0 ? (
                      <span className="text-sm text-slate-400">Drop items here</span>
                    ) : (
                      <ul className="flex flex-wrap gap-2" aria-label={`Sorted into ${groupText}`}>
                        {members.map((item, itemIndex) => (
                          // A sorted item sits inside its group's drop target: keep its own taps
                          // (pick up, put down, return) from also reaching the group as a placement.
                          <li
                            key={item.id}
                            className="flex items-center gap-1"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <Draggable id={item.id}>
                              <RichContent html={item.html} renderImage={renderImage} className="break-words" />
                            </Draggable>
                            {!disabled && (
                              <button
                                type="button"
                                aria-label={`Return ${describeLabel(item.html, `item ${itemIndex + 1}`)} to the items to sort`}
                                onClick={() => unplace(item.id)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100"
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Droppable>
                </section>
              );
            })}
          </div>
        </div>
      </DragLayer>
    </LiveAnnouncer>
  );
}
