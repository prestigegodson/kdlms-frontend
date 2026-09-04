import { ImageIcon, Minus, Square, Table, Type } from "lucide-react";
import type { DragEvent } from "react";
import type { ReportAssessmentMode } from "@/api/resultTemplates";
import { BLOCK_DEFAULT_SIZE, newElementId, type LayoutElement } from "@/features/reporting/components/designer/layout";
import { newTableSpec } from "@/features/reporting/components/designer/tableOps";
import { primeDataTransfer, setCurrentDrag } from "@/features/reporting/components/designer/dragTypes";
import { REPORT_BLOCKS } from "@/features/reporting/components/reportBlocks";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

interface PaletteItem {
  label: string;
  description: string;
  elementType: LayoutElement["type"];
  factory: () => LayoutElement;
}

function freeformItems(): PaletteItem[] {
  return [
    {
      label: "Text",
      description: "Free text - may include {{tokens}}",
      elementType: "TEXT",
      factory: () => ({ id: newElementId("el"), type: "TEXT", text: "" }),
    },
    {
      label: "Divider",
      description: "A thin horizontal rule",
      elementType: "DIVIDER",
      factory: () => ({ id: newElementId("el"), type: "DIVIDER" }),
    },
    {
      label: "Spacer",
      description: "A fixed vertical gap",
      elementType: "SPACER",
      factory: () => ({ id: newElementId("el"), type: "SPACER", heightPx: 16 }),
    },
    {
      label: "Image",
      description: "A fixed uploaded image (e.g. a crest or watermark)",
      elementType: "IMAGE",
      factory: () => ({ id: newElementId("el"), type: "IMAGE", fileId: "" }),
    },
    {
      label: "Box",
      description: "A bordered panel other elements sit inside",
      elementType: "BOX",
      factory: () => ({ id: newElementId("el"), type: "BOX", elements: [] }),
    },
    {
      label: "Table",
      description: "A grid of cells - may include {{tokens}}",
      elementType: "TABLE",
      factory: () => ({ id: newElementId("el"), type: "TABLE", table: newTableSpec() }),
    },
  ];
}

const ICONS: Record<string, typeof Type> = {
  Text: Type,
  Divider: Minus,
  Spacer: Square,
  Image: ImageIcon,
  Box: Square,
  Table: Table,
};

interface BlockPaletteProps {
  mode: ReportAssessmentMode;
  editor: LayoutEditor;
}

/**
 * The draggable/click-to-append component palette - the ten semantic
 * `ReportBlock`s (filtered to the template's own assessment mode, fixing a
 * bug the old GrapesJS designer had where a QUALITATIVE template's palette
 * still offered `SCORE_TABLE`) plus five freeform elements. Each item is
 * both `draggable` (drop onto a `DropZone`) and clickable
 * (`editor.insertAtSelection` - lands after the current selection, or at
 * the end of the canvas with nothing selected) - a system admin without a
 * mouse-drag-friendly setup still has a full path to building a layout.
 */
export function BlockPalette({ mode, editor }: BlockPaletteProps) {
  const blocks = REPORT_BLOCKS.filter((block) => !block.mode || block.mode === mode);

  const destinationCaption =
    editor.selection?.type === "element"
      ? "Clicking a block inserts it right after the selected element."
      : editor.selection?.type === "row"
        ? "Clicking a block adds it to the selected row."
        : "Clicking a block adds it to the end of the canvas.";

  /** A block in `SIZABLE_BLOCKS` (currently `STUDENT_PHOTO`/`SCHOOL_LOGO`) is the only kind the inspector lets a designer resize - seeded here so it opens at a size that already renders sensibly rather than 0x0. */
  function blockElement(blockId: (typeof REPORT_BLOCKS)[number]["id"]): LayoutElement {
    const defaultSize = BLOCK_DEFAULT_SIZE[blockId];
    return defaultSize
      ? { id: newElementId("el"), type: "BLOCK", block: blockId, maxWidthPx: defaultSize.maxWidthPx, maxHeightPx: defaultSize.maxHeightPx }
      : { id: newElementId("el"), type: "BLOCK", block: blockId };
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, label: string, elementType: LayoutElement["type"], factory: () => LayoutElement) {
    setCurrentDrag({ kind: "new-block", label, elementType, factory });
    primeDataTransfer(event.dataTransfer);
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-500">{destinationCaption}</p>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Report blocks</h3>
        <div className="space-y-1.5">
          {blocks.map((block) => (
            <button
              key={block.id}
              type="button"
              draggable
              onDragStart={(event) => handleDragStart(event, block.label, "BLOCK", () => blockElement(block.id))}
              onDragEnd={() => setCurrentDrag(null)}
              onClick={() => editor.insertAtSelection(blockElement(block.id))}
              className="w-full cursor-grab rounded-control border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-brand-400 hover:bg-brand-50/40 active:cursor-grabbing"
              title={block.description}
            >
              <div className="font-medium text-slate-700">{block.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Free-form</h3>
        <div className="space-y-1.5">
          {freeformItems().map((item) => {
            const Icon = ICONS[item.label];
            return (
              <button
                key={item.label}
                type="button"
                draggable
                onDragStart={(event) => handleDragStart(event, item.label, item.elementType, item.factory)}
                onDragEnd={() => setCurrentDrag(null)}
                onClick={() => editor.insertAtSelection(item.factory())}
                className="flex w-full cursor-grab items-center gap-2 rounded-control border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-brand-400 hover:bg-brand-50/40 active:cursor-grabbing"
                title={item.description}
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="font-medium text-slate-700">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
