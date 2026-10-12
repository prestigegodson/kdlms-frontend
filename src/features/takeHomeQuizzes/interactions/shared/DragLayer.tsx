import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { useCallback, useState, type ReactNode } from "react";
import { useAnnouncer } from "./announcer";
import { DragLayerContext, placementOf } from "./dragLayerContext";
import { useTapToPlace } from "./useTapToPlace";

// Every move is announced once, through LiveAnnouncer - dnd-kit's own live region stays silent.
const SILENT: Announcements = {
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

const INSTRUCTIONS =
  "Press Enter or Space, or tap, to pick this up, then choose where to place it. You can also drag it.";

export interface DragLayerProps {
  /** Places `itemId` on `targetId` - called by a drop and by tap-to-place alike. */
  onPlace(itemId: string, targetId: string): void;
  /** A human name for an item or target id, for announcements. */
  describe(id: string): string;
  disabled?: boolean;
  /** What follows the pointer while dragging - defaults to nothing (the item itself moves). */
  renderOverlay?(itemId: string): ReactNode;
  children: ReactNode;
}

/**
 * The shared drag-and-drop surface for interactive questions (interaction-quiz.md §7). Pointer and
 * touch drags go through dnd-kit; keyboard and tap answers go through `useTapToPlace`, which this
 * layer owns and hands to every `Draggable`/`Droppable` inside it, so both paths end in the same
 * `onPlace` call and the same announcement. dnd-kit's KeyboardSensor is deliberately not used: its
 * Enter/Space pick-up would compete with tap-to-place's on the same element.
 */
export function DragLayer({
  onPlace,
  describe,
  disabled = false,
  renderOverlay,
  children,
}: DragLayerProps) {
  const announce = useAnnouncer();
  const tap = useTapToPlace({ onPlace, describe, disabled });
  const [active, setActive] = useState<UniqueIdentifier | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      tap.cancel();
      setActive(event.active.id);
      announce(`${describe(String(event.active.id))} picked up.`);
    },
    [announce, describe, tap],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActive(null);
      const placement = placementOf(event);
      if (placement === null) {
        announce(`${describe(String(event.active.id))} put back.`);
        return;
      }
      onPlace(placement.itemId, placement.targetId);
      announce(`${describe(placement.itemId)} placed in ${describe(placement.targetId)}.`);
    },
    [announce, describe, onPlace],
  );

  return (
    <DragLayerContext.Provider value={{ tap, disabled }}>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
        accessibility={{
          announcements: SILENT,
          screenReaderInstructions: { draggable: INSTRUCTIONS },
        }}
      >
        {children}
        <DragOverlay>
          {active !== null && renderOverlay ? renderOverlay(String(active)) : null}
        </DragOverlay>
      </DndContext>
    </DragLayerContext.Provider>
  );
}
