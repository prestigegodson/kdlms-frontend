import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { useDragLayer } from "./dragLayerContext";

/**
 * Somewhere an item can go - a zone, a slot, a group. Accepts a drop, and a tap or Enter/Space
 * while an item is picked up. `label` names it for assistive tech when its content alone doesn't.
 */
export function Droppable({
  id,
  label,
  className = "",
  children,
}: {
  id: string;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const { tap, disabled } = useDragLayer();
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  const awaiting = tap.selected !== null;

  return (
    <div
      ref={setNodeRef}
      {...tap.targetProps(id)}
      aria-label={label}
      data-over={isOver || undefined}
      className={`min-h-11 min-w-11 rounded-lg border-2 border-dashed p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        isOver ? "border-brand-500 bg-brand-50" : awaiting ? "border-brand-300" : "border-slate-300"
      } ${className}`}
    >
      {children}
    </div>
  );
}
