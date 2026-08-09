import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RowShell } from "@/features/reporting/components/designer/RowShell";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

/**
 * The designer's A4-proportioned canvas - deliberately the same 794px/shadow
 * treatment as `ReportPreviewFrame`, so this and the real preview visually
 * agree even though only the preview is authoritative (see this feature's
 * module comment). Clicking the page background (not a row/element) selects
 * the page itself, surfacing page-level settings in `InspectorPanel`.
 */
export function DesignerCanvas({ editor }: { editor: LayoutEditor }) {
  return (
    <div className="flex justify-center overflow-x-auto overscroll-x-contain rounded-panel bg-slate-100 p-4 sm:p-8">
      <div
        onClick={() => editor.setSelection({ type: "page" })}
        className="w-full max-w-[794px] shrink-0 space-y-3 bg-white shadow-lg"
        style={{
          padding: `${editor.layout.page.paddingPx}px`,
          fontFamily: editor.layout.page.fontFamily,
          fontSize: `${editor.layout.page.fontSizePx}px`,
          color: editor.layout.page.color,
          minHeight: "1122px", // 794 * (297/210) - true A4 aspect at this width
        }}
      >
        {editor.layout.rows.map((row, index) => (
          <RowShell key={row.id} row={row} index={index} rowCount={editor.layout.rows.length} editor={editor} />
        ))}
        <div className="pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              editor.addRow();
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add row
          </Button>
        </div>
      </div>
    </div>
  );
}
