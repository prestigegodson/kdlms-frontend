import { ElementCard } from "@/features/reporting/components/designer/ElementCard";
import { DropZone } from "@/features/reporting/components/designer/DropZone";
import type { DragPayload } from "@/features/reporting/components/designer/dragTypes";
import type { LayoutElement } from "@/features/reporting/components/designer/layout";
import { type ContainerKind, canPlace, findElementLocation } from "@/features/reporting/components/designer/layoutOps";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

interface ElementListProps {
  containerId: string;
  elements: LayoutElement[];
  editor: LayoutEditor;
  /** What kind of container this list renders for - drives `canPlace`'s nesting rules (mirrors `ReportLayoutValidator`). */
  containerKind: ContainerKind;
  /** Tighter vertical rhythm for a table cell's own element list, so a small cell doesn't balloon - see `TableEditorGrid`. */
  compact?: boolean;
}

/**
 * Renders one container's elements interleaved with drop-zone strips - used
 * for a column's own elements and, recursively, for a BOX's children or a
 * TABLE cell's own elements. A drop here either inserts a brand-new palette
 * block/element or completes a move started by `ElementCard`'s own
 * `dragstart` - both checked against `canPlace` so a BOX can't land inside
 * another BOX and a BOX/TABLE can't land inside a cell, however the drag
 * started.
 */
export function ElementList({ containerId, elements, editor, containerKind, compact }: ElementListProps) {
  function handleDrop(index: number, payload: DragPayload) {
    if (payload.kind === "new-block") {
      if (!canPlace(payload.elementType, containerKind)) return;
      editor.insertElement(containerId, index, payload.factory());
    } else {
      const dragged = findElementLocation(editor.layout, payload.elementId);
      if (dragged && !canPlace(dragged.element.type, containerKind)) return;
      editor.moveElement(payload.elementId, containerId, index);
      editor.setSelection({ type: "element", elementId: payload.elementId });
    }
  }

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      <DropZone emphasized={elements.length === 0} compact={compact} onDrop={(payload) => handleDrop(0, payload)} />
      {elements.map((element, index) => (
        <div key={element.id}>
          <ElementCard
            element={element}
            index={index}
            siblingCount={elements.length}
            containerId={containerId}
            editor={editor}
            containerKind={containerKind}
          />
          <DropZone compact={compact} onDrop={(payload) => handleDrop(index + 1, payload)} />
        </div>
      ))}
    </div>
  );
}
