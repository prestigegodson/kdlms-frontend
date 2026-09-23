import { ChevronDown, ChevronRight, ChevronUp, EyeOff, Trash2 } from "lucide-react";
import { ColumnShell } from "@/features/reporting/components/designer/ColumnShell";
import { describeRowCondition, type LayoutRow } from "@/features/reporting/components/designer/layout";
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
  /** View-only, owned by `DesignerCanvas` - collapses this row to a one-line summary so a long canvas is easier to navigate. Never persisted. */
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function RowShell({ row, index, rowCount, editor, collapsed, onToggleCollapse }: RowShellProps) {
  const selected = editor.selection?.type === "row" && editor.selection.rowId === row.id;
  const currentKey = presetKey(row.columns.map((c) => c.widthPercent));
  const matchesPreset = COLUMN_PRESETS.some((preset) => presetKey(preset.widths) === currentKey);
  const elementCount = row.columns.reduce((sum, column) => sum + column.elements.length, 0);
  const conditional = (row.condition?.rules.length ?? 0) > 0;

  return (
    <div
      onClick={() => editor.setSelection({ type: "row", rowId: row.id })}
      className={`group relative cursor-pointer rounded-panel border p-2 transition-colors ${
        conditional ? "border-dashed" : ""
      } ${selected ? "border-brand-500 bg-brand-50/40" : "border-slate-200 hover:border-slate-300"}`}
      style={{
        marginTop: row.style?.marginTopPx,
        // The server never emits margin-bottom on the last row (LayoutHtmlEmitter) - a trailing
        // bottom margin can only push content past the page boundary, never do anything useful.
        // Matched here so the canvas doesn't show a bottom gap the PDF will never actually have.
        marginBottom: index === rowCount - 1 ? undefined : row.style?.marginBottomPx,
        backgroundColor: row.style?.backgroundColor,
      }}
    >
      {conditional && (
        // Deliberately a sibling of the hover-only toolbar below, not inside it - this
        // must stay visible while scanning the canvas for conditional rows, exactly
        // when the toolbar's own opacity-0 would otherwise hide it.
        <span
          title={describeRowCondition(row.condition!)}
          className="absolute -top-2 right-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
        >
          <EyeOff className="h-3 w-3" aria-hidden="true" />
          Conditional
        </span>
      )}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={collapsed ? "Expand row" : "Collapse row"}
            aria-expanded={!collapsed}
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse();
            }}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          {collapsed ? (
            <span className="truncate text-xs text-slate-500">
              Row {index + 1} · {row.columns.length} column{row.columns.length === 1 ? "" : "s"} · {elementCount}{" "}
              element{elementCount === 1 ? "" : "s"}
              {conditional ? " · Conditional" : ""}
            </span>
          ) : (
            // Always visible (not hover-gated like the select/actions below) - a row can be
            // fully packed with elements, each of which stops click propagation to select
            // itself (ElementCard), so this is the one reliable, labeled handle for selecting
            // the row rather than something inside it (needed for its Visibility section, and
            // its margin/padding/background/border style fields).
            <button
              type="button"
              title="Click to configure this row (style, columns, visibility)"
              onClick={(event) => {
                event.stopPropagation();
                editor.setSelection({ type: "row", rowId: row.id });
              }}
              className={`shrink-0 truncate rounded-control px-1.5 py-0.5 text-xs font-medium transition-colors ${
                selected ? "bg-brand-100 text-brand-700" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              Row {index + 1}
            </button>
          )}
        </div>
        <div
          className={`flex shrink-0 items-center gap-0.5 ${
            collapsed ? "" : "opacity-0 transition-opacity group-hover:opacity-100 has-[:focus]:opacity-100"
          }`}
        >
          {!collapsed && (
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
          )}
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
      {!collapsed && (
        <div className="flex gap-2">
          {row.columns.map((column) => (
            <ColumnShell key={column.id} column={column} editor={editor} />
          ))}
        </div>
      )}
    </div>
  );
}
