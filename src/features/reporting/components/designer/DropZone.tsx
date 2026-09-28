import { type DragEvent, useState } from "react";
import { type DragPayload, getCurrentDrag } from "@/features/reporting/components/designer/dragTypes";

interface DropZoneProps {
  /** A new palette block, or an existing element being moved, dropped at this exact position. */
  onDrop: (payload: DragPayload) => void;
  /** Slightly taller when a column is otherwise empty, so it's still a comfortable drop target. */
  emphasized?: boolean;
  /** Thinner idle height - a table cell's own drop strips, so a small cell doesn't grow just from being a drop target. */
  compact?: boolean;
}

/**
 * A thin horizontal strip between elements (or at the top/bottom of a
 * column) that lights up while something's dragging over it. `onDragOver`
 * must call `preventDefault()` or the browser never fires `drop` at all -
 * the single most common way to silently break native HTML5 DnD. The actual
 * payload comes from `getCurrentDrag()` (a module-scoped ref), not from
 * `DataTransfer` - see `dragTypes.ts` for why.
 */
export function DropZone({ onDrop, emphasized = false, compact = false }: DropZoneProps) {
  const [active, setActive] = useState(false);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActive(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    // Stop here rather than bubble - a container that wraps a DropZone (e.g. a
    // table cell's own fallback drop target) must not also process this drop.
    event.stopPropagation();
    setActive(false);
    const payload = getCurrentDrag();
    if (payload) onDrop(payload);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setActive(false)}
      onDrop={handleDrop}
      className={`rounded-control transition-all ${
        active
          ? compact
            ? "h-4 border-2 border-dashed border-brand-500 bg-brand-50"
            : "h-8 border-2 border-dashed border-brand-500 bg-brand-50"
          : emphasized
            ? compact
              ? "h-3"
              : "h-6"
            : compact
              ? "h-1"
              : "h-2"
      }`}
    />
  );
}
