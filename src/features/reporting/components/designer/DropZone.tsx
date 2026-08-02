import { type DragEvent, useState } from "react";
import { type DragPayload, getCurrentDrag } from "@/features/reporting/components/designer/dragTypes";

interface DropZoneProps {
  /** A new palette block, or an existing element being moved, dropped at this exact position. */
  onDrop: (payload: DragPayload) => void;
  /** Slightly taller when a column is otherwise empty, so it's still a comfortable drop target. */
  emphasized?: boolean;
}

/**
 * A thin horizontal strip between elements (or at the top/bottom of a
 * column) that lights up while something's dragging over it. `onDragOver`
 * must call `preventDefault()` or the browser never fires `drop` at all -
 * the single most common way to silently break native HTML5 DnD. The actual
 * payload comes from `getCurrentDrag()` (a module-scoped ref), not from
 * `DataTransfer` - see `dragTypes.ts` for why.
 */
export function DropZone({ onDrop, emphasized = false }: DropZoneProps) {
  const [active, setActive] = useState(false);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActive(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
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
        active ? "h-8 border-2 border-dashed border-brand-500 bg-brand-50" : emphasized ? "h-6" : "h-2"
      }`}
    />
  );
}
