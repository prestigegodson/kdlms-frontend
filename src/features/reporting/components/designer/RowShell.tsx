import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { ColumnShell } from "@/features/reporting/components/designer/ColumnShell";
import type { LayoutRow } from "@/features/reporting/components/designer/layout";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

interface ColumnPreset {
  label: string;
  widths: number[];
}

/**
 * A row's column split is chosen from a fixed preset list rather than a
 * drag-to-resize handle - the UI kit has no Slider/Resizable primitive, and
 * a preset list makes "widths sum to 100" true by construction instead of
 * by validation. Mirrors the preset set documented in the implementation
 * plan.
 */
const COLUMN_PRESETS: ColumnPreset[] = [
  { label: "1 column", widths: [100] },
  { label: "2 columns - 50 / 50", widths: [50, 50] },
  { label: "2 columns - 60 / 40", widths: [60, 40] },
  { label: "2 columns - 40 / 60", widths: [40, 60] },
  { label: "2 columns - 65 / 35", widths: [65, 35] },
  { label: "2 columns - 35 / 65", widths: [35, 65] },
  { label: "2 columns - 70 / 30", widths: [70, 30] },
  { label: "2 columns - 30 / 70", widths: [30, 70] },
  { label: "3 columns - 34 / 33 / 33", widths: [34, 33, 33] },
  { label: "3 columns - 50 / 25 / 25", widths: [50, 25, 25] },
  { label: "3 columns - 25 / 50 / 25", widths: [25, 50, 25] },
  { label: "3 columns - 25 / 25 / 50", widths: [25, 25, 50] },
];

function presetKey(widths: number[]): string {
  return widths.join("-");
}

interface RowShellProps {
  row: LayoutRow;
  index: number;
  rowCount: number;
  editor: LayoutEditor;
}

export function RowShell({ row, index, rowCount, editor }: RowShellProps) {
  const selected = editor.selection?.type === "row" && editor.selection.rowId === row.id;
  const currentKey = presetKey(row.columns.map((c) => c.widthPercent));
  const matchesPreset = COLUMN_PRESETS.some((preset) => presetKey(preset.widths) === currentKey);

  return (
    <div
      onClick={() => editor.setSelection({ type: "row", rowId: row.id })}
      className={`group rounded-panel border p-2 transition-colors ${
        selected ? "border-brand-500 bg-brand-50/40" : "border-slate-200 hover:border-slate-300"
      }`}
      style={{
        marginTop: row.style?.marginTopPx,
        marginBottom: row.style?.marginBottomPx,
        backgroundColor: row.style?.backgroundColor,
      }}
    >
      <div className="mb-2 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100 has-[:focus]:opacity-100">
        <select
          aria-label="Column split"
          value={matchesPreset ? currentKey : "custom"}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const preset = COLUMN_PRESETS.find((p) => presetKey(p.widths) === event.target.value);
            if (preset) editor.setColumnWidths(row.id, preset.widths);
          }}
          className="rounded-control border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
        >
          {!matchesPreset && (
            <option value="custom" disabled>
              Custom split
            </option>
          )}
          {COLUMN_PRESETS.map((preset) => (
            <option key={preset.label} value={presetKey(preset.widths)}>
              {preset.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Move row up"
            disabled={index === 0}
            onClick={(event) => {
              event.stopPropagation();
              editor.moveRow(row.id, "up");
            }}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Move row down"
            disabled={index === rowCount - 1}
            onClick={(event) => {
              event.stopPropagation();
              editor.moveRow(row.id, "down");
            }}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Delete row"
            onClick={(event) => {
              event.stopPropagation();
              editor.removeRow(row.id);
            }}
            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        {row.columns.map((column) => (
          <ColumnShell key={column.id} column={column} editor={editor} />
        ))}
      </div>
    </div>
  );
}
