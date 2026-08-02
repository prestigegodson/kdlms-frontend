import { ElementList } from "@/features/reporting/components/designer/ElementList";
import type { LayoutColumn } from "@/features/reporting/components/designer/layout";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

interface ColumnShellProps {
  column: LayoutColumn;
  editor: LayoutEditor;
}

/** One column's canvas chrome - a width label plus its element list. Columns are always shown side by side on the canvas, matching the emitted `<td>`s' `table-layout:fixed` behaviour. */
export function ColumnShell({ column, editor }: ColumnShellProps) {
  return (
    <div className="min-w-0 flex-1 rounded-control border border-slate-200 bg-white p-2" style={{ flexBasis: `${column.widthPercent}%` }}>
      <div className="mb-1 text-[10px] font-medium text-slate-400">{column.widthPercent}%</div>
      <ElementList containerId={column.id} elements={column.elements} editor={editor} insideBox={false} />
    </div>
  );
}
