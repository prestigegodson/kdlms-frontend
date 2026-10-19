import { useRef } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { RichContent } from "@/components/richText/RichContent";
import { Button } from "@/components/ui/Button";
import { useAnnouncer } from "../shared/announcer";
import { describeLabel } from "../shared/labels";
import { LiveAnnouncer } from "../shared/LiveAnnouncer";
import type { RenderImage } from "../types";
import type { SequencePlayerConfig, SequenceResponse } from "./types";

interface SequencePlayerProps {
  config: SequencePlayerConfig;
  value: SequenceResponse | null;
  onChange(response: SequenceResponse): void;
  disabled: boolean;
  renderImage?: RenderImage;
}

/**
 * Puts a sequence's items in order (interaction-quiz.md §7). Pointer and touch drag a row through
 * dnd-kit's sortable list; every row also has Move up/Move down buttons, so no answer depends on
 * dragging and a keyboard reaches every position. The question stays unanswered until the student
 * moves something or confirms the order they were shown - the shuffled order is never submitted
 * on its own.
 */
export function SequencePlayer(props: SequencePlayerProps) {
  return (
    <LiveAnnouncer>
      <SequenceList {...props} />
    </LiveAnnouncer>
  );
}

function SequenceList({ config, value, onChange, disabled, renderImage }: SequencePlayerProps) {
  const announce = useAnnouncer();
  // The last row the drag was over - a fast flick can end before dnd-kit recomputes `over`, so the
  // drop falls back to this rather than silently snapping the row back.
  const lastOverRef = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );
  const byId = new Map(config.items.map((item) => [item.id, item]));
  const order = currentOrder(config, value);
  const timeline = config.presentation === "TIMELINE";

  function describe(id: string, index: number): string {
    return describeLabel(byId.get(id)?.html ?? "", `Item ${index + 1}`);
  }

  function move(from: number, to: number) {
    if (disabled || to < 0 || to >= order.length || from === to) {
      return;
    }
    const next = arrayMove(order, from, to);
    onChange({ order: next });
    announce(`${describe(order[from], from)} moved to position ${to + 1} of ${order.length}.`);
  }

  function resetLastOver() {
    lastOverRef.current = null;
  }

  function onDragOver(event: DragOverEvent) {
    if (event.over) {
      lastOverRef.current = String(event.over.id);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : lastOverRef.current;
    lastOverRef.current = null;
    if (!overId) {
      return;
    }
    move(order.indexOf(String(event.active.id)), order.indexOf(overId));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {timeline ? "Put these events in order, earliest first." : "Put these in the correct order."} Drag a
        row, or use its arrows.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={resetLastOver}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={resetLastOver}
        accessibility={{ announcements: SILENT }}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy} disabled={disabled}>
          <ol className={`space-y-2 ${timeline ? "border-l-2 border-brand-200 pl-4" : ""}`} aria-label="Order">
            {order.map((id, index) => (
              <SequenceRow
                key={id}
                id={id}
                index={index}
                count={order.length}
                html={byId.get(id)?.html ?? ""}
                label={describe(id, index)}
                timeline={timeline}
                disabled={disabled}
                renderImage={renderImage}
                onMove={(to) => move(index, to)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {value === null && !disabled && (
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange({ order })}>
          Keep this order
        </Button>
      )}
    </div>
  );
}

const SILENT = {
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

/** The saved order, or the order shown - the saved one filtered to items still in the question. */
function currentOrder(config: SequencePlayerConfig, value: SequenceResponse | null): string[] {
  const shown = config.items.map((item) => item.id);
  if (!value) {
    return shown;
  }
  const known = new Set(shown);
  const saved = [...new Set(value.order.filter((id) => known.has(id)))];
  return [...saved, ...shown.filter((id) => !saved.includes(id))];
}

function SequenceRow({
  id,
  index,
  count,
  html,
  label,
  timeline,
  disabled,
  renderImage,
  onMove,
}: {
  id: string;
  index: number;
  count: number;
  html: string;
  label: string;
  timeline: boolean;
  disabled: boolean;
  renderImage?: RenderImage;
  onMove(to: number): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex min-h-14 items-center gap-2 rounded-card border-2 bg-white px-2 py-2 ${
        isDragging ? "z-10 border-brand-400 shadow-md" : "border-slate-200"
      }`}
    >
      {timeline && (
        <span aria-hidden="true" className="absolute -left-[1.4rem] h-3 w-3 rounded-full bg-brand-400" />
      )}
      <span
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-hidden="true"
        className={`flex h-11 w-8 shrink-0 touch-none items-center justify-center text-slate-400 ${
          disabled ? "" : "cursor-grab"
        }`}
      >
        <GripVertical className="h-5 w-5" />
      </span>
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700"
      >
        {index + 1}
      </span>
      <RichContent html={html} renderImage={renderImage} className="min-w-0 flex-1 break-words text-base" />
      <span className="sr-only">
        {label}, position {index + 1} of {count}
      </span>
      {!disabled && (
        <span className="flex shrink-0 flex-col">
          <button
            type="button"
            aria-label={`Move ${label} up`}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
            className="flex h-11 w-11 items-center justify-center rounded-control text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronUp className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${label} down`}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-control text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronDown className="h-5 w-5" aria-hidden="true" />
          </button>
        </span>
      )}
    </li>
  );
}
