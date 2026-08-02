import { ElementCard } from "@/features/reporting/components/designer/ElementCard";
import { DropZone } from "@/features/reporting/components/designer/DropZone";
import type { DragPayload } from "@/features/reporting/components/designer/dragTypes";
import type { LayoutElement } from "@/features/reporting/components/designer/layout";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

interface ElementListProps {
  containerId: string;
  elements: LayoutElement[];
  editor: LayoutEditor;
  /** True one level down inside a BOX - a BOX may not accept another BOX (mirrors `ReportLayoutValidator`). */
  insideBox: boolean;
}

/**
 * Renders one container's elements interleaved with drop-zone strips - used
 * both for a column's own elements and, recursively, for a BOX's children.
 * A drop here either inserts a brand-new palette block/element or completes
 * a move started by `ElementCard`'s own `dragstart`.
 */
export function ElementList({ containerId, elements, editor, insideBox }: ElementListProps) {
  function handleDrop(index: number, payload: DragPayload) {
    if (payload.kind === "new-block") {
      if (insideBox && payload.elementType === "BOX") return; // A BOX may not contain another BOX.
      editor.insertElement(containerId, index, payload.factory());
    } else {
      editor.moveElement(payload.elementId, containerId, index);
      editor.setSelection({ type: "element", elementId: payload.elementId });
    }
  }

  return (
    <div className="space-y-1">
      <DropZone emphasized={elements.length === 0} onDrop={(payload) => handleDrop(0, payload)} />
      {elements.map((element, index) => (
        <div key={element.id}>
          <ElementCard
            element={element}
            index={index}
            siblingCount={elements.length}
            containerId={containerId}
            editor={editor}
            insideBox={insideBox}
          />
          <DropZone onDrop={(payload) => handleDrop(index + 1, payload)} />
        </div>
      ))}
    </div>
  );
}
