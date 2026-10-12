import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { useDragLayer } from "./dragLayerContext";

/**
 * Something a student moves - a label, an item, a match. Draggable by pointer or touch, and
 * pickable by tap or Enter/Space (the surrounding `DragLayer`'s tap-to-place), with a 44px minimum
 * target. `aria-pressed` marks the picked-up item.
 */
export function Draggable({
  id,
  className = "",
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { tap, disabled } = useDragLayer();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  });
  const tapProps = tap.itemProps(id);
  const picked = tap.selected === id;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...tapProps}
      style={{ transform: CSS.Translate.toString(transform) }}
      data-picked={picked || undefined}
      className={`min-h-11 min-w-11 touch-none select-none rounded-lg border bg-white px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        picked ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-300"
      } ${isDragging ? "opacity-60" : ""} ${disabled ? "cursor-default" : "cursor-grab"} ${className}`}
    >
      {children}
    </div>
  );
}
