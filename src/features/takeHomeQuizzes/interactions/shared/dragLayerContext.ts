import type { DragEndEvent } from "@dnd-kit/core";
import { createContext, useContext } from "react";
import type { TapToPlace } from "./useTapToPlace";

export interface DragLayerValue {
  tap: TapToPlace;
  disabled: boolean;
}

export const DragLayerContext = createContext<DragLayerValue | null>(null);

/** The surrounding `DragLayer`'s tap-to-place state - what `Draggable`/`Droppable` read. */
export function useDragLayer(): DragLayerValue {
  const value = useContext(DragLayerContext);
  if (value === null) {
    throw new Error("Draggable and Droppable must sit inside a DragLayer.");
  }
  return value;
}

/** The placement a finished drag makes, or `null` when it was dropped nowhere. */
export function placementOf(
  event: Pick<DragEndEvent, "active" | "over">,
): { itemId: string; targetId: string } | null {
  if (!event.over) {
    return null;
  }
  return { itemId: String(event.active.id), targetId: String(event.over.id) };
}
