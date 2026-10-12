import { useDroppable } from "@dnd-kit/core";
import { X } from "lucide-react";
import { useCallback } from "react";
import { RichContent } from "@/components/richText/RichContent";
import { DragLayer } from "../shared/DragLayer";
import { useDragLayer } from "../shared/dragLayerContext";
import { Draggable } from "../shared/Draggable";
import { Droppable } from "../shared/Droppable";
import { percent, type RectShape } from "../shared/geometry";
import { describeLabel } from "../shared/labels";
import { LiveAnnouncer } from "../shared/LiveAnnouncer";
import { NormalizedImageStage } from "../shared/NormalizedImageStage";
import type { RenderImage } from "../types";
import type { DiagramLabelPlayerConfig, DiagramLabelResponse } from "./types";

interface DiagramLabelPlayerProps {
  config: DiagramLabelPlayerConfig;
  value: DiagramLabelResponse | null;
  onChange(response: DiagramLabelResponse): void;
  disabled: boolean;
  renderImage?: RenderImage;
}

const ON_IMAGE = "zone:";
const IN_LIST = "slot:";

/**
 * Labels a diagram (interaction-quiz.md §7): drag a label onto a numbered zone on the image, or tap
 * (Enter/Space) the label and then the zone. Each zone is also listed under the image as a full-size
 * target, so a tiny zone on a phone is still easy to hit, and that list is what the keyboard and
 * screen readers use. Without `reuseLabels` a placed label leaves the bank, and placing it again moves it.
 */
export function DiagramLabelPlayer({ config, value, onChange, disabled, renderImage }: DiagramLabelPlayerProps) {
  const labelById = new Map(config.labels.map((label) => [label.id, label]));
  const zoneIds = new Set(config.zones.map((zone) => zone.id));
  const placements = Object.fromEntries(
    Object.entries(value?.placements ?? {}).filter(([zone, label]) => zoneIds.has(zone) && labelById.has(label)),
  );
  const placed = new Set(Object.values(placements));
  const bank = config.reuseLabels ? config.labels : config.labels.filter((label) => !placed.has(label.id));

  const describe = useCallback(
    (id: string) => {
      const zoneId = id.replace(ON_IMAGE, "").replace(IN_LIST, "");
      const zoneIndex = config.zones.findIndex((zone) => zone.id === zoneId);
      if (zoneIndex >= 0) {
        return `zone ${zoneIndex + 1}`;
      }
      const labelIndex = config.labels.findIndex((label) => label.id === id);
      return describeLabel(config.labels[labelIndex]?.html ?? "", `Label ${labelIndex + 1}`);
    },
    [config],
  );

  function place(labelId: string, targetId: string) {
    const zoneId = targetId.replace(ON_IMAGE, "").replace(IN_LIST, "");
    if (!labelById.has(labelId) || !zoneIds.has(zoneId)) {
      return;
    }
    const next: Record<string, string> = {};
    for (const [zone, label] of Object.entries(placements)) {
      if (config.reuseLabels || label !== labelId) {
        next[zone] = label;
      }
    }
    next[zoneId] = labelId;
    onChange({ placements: next });
  }

  function clear(zoneId: string) {
    const next = { ...placements };
    delete next[zoneId];
    onChange({ placements: next });
  }

  return (
    <LiveAnnouncer>
      <DragLayer onPlace={place} describe={describe} disabled={disabled}>
        <div className="space-y-4">
          <NormalizedImageStage
            fileId={config.imageFileId}
            aspect={config.imageAspect}
            alt="The diagram to label"
            renderImage={renderImage}
          >
            {config.zones.map((zone, index) => {
              const label = placements[zone.id] ? labelById.get(placements[zone.id]) : undefined;
              return (
                <ZoneOnImage
                  key={zone.id}
                  id={`${ON_IMAGE}${zone.id}`}
                  shape={zone.shape}
                  number={index + 1}
                  text={label ? describeLabel(label.html, "(image)") : null}
                />
              );
            })}
          </NormalizedImageStage>

          <div>
            <p className="mb-2 text-sm text-slate-600">
              Labels - drag one onto a zone, or tap it and then the zone.
            </p>
            {bank.length === 0 ? (
              <p className="text-sm text-slate-400">Every label has been placed.</p>
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label="Labels">
                {bank.map((label) => (
                  <li key={label.id}>
                    <Draggable id={label.id}>
                      <RichContent html={label.html} renderImage={renderImage} className="break-words" />
                    </Draggable>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ol className="grid gap-2 sm:grid-cols-2" aria-label="Zones">
            {config.zones.map((zone, index) => {
              const label = placements[zone.id] ? labelById.get(placements[zone.id]) : undefined;
              const number = index + 1;
              return (
                <li key={zone.id}>
                  <Droppable id={`${IN_LIST}${zone.id}`} label={`Zone ${number}`} className="flex items-center gap-2">
                    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 px-1 text-xs font-semibold text-white">
                      {number}
                    </span>
                    {label ? (
                      // A placed label sits inside its zone's drop target: keep its own taps (pick up,
                      // clear) from also reaching the zone as a placement.
                      <span
                        className="flex min-w-0 flex-1 items-center gap-1"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {config.reuseLabels ? (
                          <RichContent html={label.html} renderImage={renderImage} className="min-w-0 flex-1 break-words" />
                        ) : (
                          <Draggable id={label.id} className="min-w-0 flex-1">
                            <RichContent html={label.html} renderImage={renderImage} className="break-words" />
                          </Draggable>
                        )}
                        {!disabled && (
                          <button
                            type="button"
                            aria-label={`Clear zone ${number}`}
                            onClick={() => clear(zone.id)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">Drop a label here</span>
                    )}
                  </Droppable>
                </li>
              );
            })}
          </ol>
        </div>
      </DragLayer>
    </LiveAnnouncer>
  );
}

/** A zone this close to the image's top edge gets its chip below it, where the stage won't clip it. */
const CHIP_BELOW_UNDER_Y = 0.08;

/**
 * A zone drawn where it is on the image - a drop and tap target for pointer and touch. It stays out
 * of the tab order and the accessibility tree: the zone list below is the same target, full size.
 * The region itself is only outlined, never filled, and its number and placed label sit in a chip
 * just outside it, so the part of the picture being labelled stays fully visible.
 */
function ZoneOnImage({ id, shape, number, text }: { id: string; shape: RectShape; number: number; text: string | null }) {
  const { tap, disabled } = useDragLayer();
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  const awaiting = tap.selected !== null;
  const chipBelow = shape.y < CHIP_BELOW_UNDER_Y;
  return (
    <div
      ref={setNodeRef}
      {...tap.targetProps(id)}
      tabIndex={-1}
      aria-hidden="true"
      data-over={isOver || undefined}
      className={`absolute rounded border-2 shadow-[0_0_0_1px_rgba(255,255,255,0.9)] ${
        isOver
          ? "border-solid border-brand-600 bg-brand-500/10"
          : awaiting
            ? "border-dashed border-brand-500 bg-transparent"
            : "border-dashed border-slate-800 bg-transparent"
      }`}
      style={{ left: percent(shape.x), top: percent(shape.y), width: percent(shape.w), height: percent(shape.h) }}
    >
      <span
        className={`pointer-events-none absolute left-0 flex max-w-[10rem] items-center gap-1 whitespace-nowrap rounded-full bg-white p-0.5 text-xs shadow ${text ? "pr-1.5" : ""} ${
          chipBelow ? "top-full mt-0.5" : "bottom-full mb-0.5"
        }`}
      >
        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 px-0.5 text-[10px] font-semibold text-white">
          {number}
        </span>
        {text && <span className="truncate font-medium text-slate-900">{text}</span>}
      </span>
    </div>
  );
}
