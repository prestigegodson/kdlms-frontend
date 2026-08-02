import type { LayoutElement } from "@/features/reporting/components/designer/layout";

/**
 * Native HTML5 drag-and-drop, deliberately not a library (see
 * `TemplateDesignerPage`'s module comment) - the drop model here is a fixed
 * set of thin strips between elements, exactly what native DnD handles
 * without a sortable library's collision detection or transform math.
 * <p>
 * `DataTransfer.getData` is unreadable during `dragover` (only on `drop`),
 * so the actual payload lives in this module-scoped ref rather than in
 * `dataTransfer` - `dataTransfer.setData` is still called on `dragstart`
 * (with a throwaway value) purely because Firefox refuses to start a drag
 * at all if nothing was set.
 */
export type DragPayload =
  | { kind: "new-block"; label: string; elementType: LayoutElement["type"]; factory: () => LayoutElement }
  | { kind: "move-element"; elementId: string };

let current: DragPayload | null = null;

export function setCurrentDrag(payload: DragPayload | null): void {
  current = payload;
}

export function getCurrentDrag(): DragPayload | null {
  return current;
}

/** Firefox needs *something* set via the real DataTransfer API to allow a drag to start. */
export function primeDataTransfer(dataTransfer: DataTransfer): void {
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData("text/plain", "kdlms-layout-element");
}
