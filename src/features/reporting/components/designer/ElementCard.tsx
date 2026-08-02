import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import type { DragEvent } from "react";
import { ElementList } from "@/features/reporting/components/designer/ElementList";
import { ElementPreview } from "@/features/reporting/components/designer/ElementPreview";
import { primeDataTransfer, setCurrentDrag } from "@/features/reporting/components/designer/dragTypes";
import type { LayoutElement } from "@/features/reporting/components/designer/layout";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

interface ElementCardProps {
  element: LayoutElement;
  index: number;
  siblingCount: number;
  containerId: string;
  editor: LayoutEditor;
  insideBox: boolean;
}

const ELEMENT_LABELS: Record<LayoutElement["type"], string> = {
  BLOCK: "Block",
  TEXT: "Text",
  DIVIDER: "Divider",
  SPACER: "Spacer",
  IMAGE: "Image",
  BOX: "Box",
};

/** One selectable, draggable, reorderable element on the canvas - the up/down/delete buttons are the keyboard-accessible equivalent of the drag handle, per the designer's a11y requirement. */
export function ElementCard({ element, index, siblingCount, editor }: ElementCardProps) {
  const selected = editor.selection?.type === "element" && editor.selection.elementId === element.id;

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    setCurrentDrag({ kind: "move-element", elementId: element.id });
    primeDataTransfer(event.dataTransfer);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setCurrentDrag(null)}
      onClick={(event) => {
        event.stopPropagation();
        editor.setSelection({ type: "element", elementId: element.id });
      }}
      className={`group relative rounded-control border p-1.5 transition-colors ${
        selected ? "border-brand-500 ring-1 ring-brand-500" : "border-transparent hover:border-slate-300"
      }`}
    >
      <div className="mb-1 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100 has-[:focus]:opacity-100">
        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          <GripVertical className="h-3 w-3 cursor-grab" aria-hidden="true" />
          {ELEMENT_LABELS[element.type]}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Move up"
            disabled={index === 0}
            onClick={(event) => {
              event.stopPropagation();
              editor.moveElementDirection(element.id, "up");
            }}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index === siblingCount - 1}
            onClick={(event) => {
              event.stopPropagation();
              editor.moveElementDirection(element.id, "down");
            }}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Delete element"
            onClick={(event) => {
              event.stopPropagation();
              editor.removeElement(element.id);
            }}
            className="rounded p-0.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {element.type === "BOX" ? (
        <div className="rounded-control border border-dashed border-slate-300 bg-slate-50/50 p-2">
          <ElementList containerId={element.id} elements={element.elements} editor={editor} insideBox />
        </div>
      ) : (
        <ElementPreview element={element} />
      )}
    </div>
  );
}
