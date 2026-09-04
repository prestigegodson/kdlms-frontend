import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  ALLOWED_FONT_FAMILIES,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  SIZABLE_BLOCKS,
  TABLE_BORDER_STYLES,
  type ElementStyle,
  type LayoutElement,
  type TableCell,
  type TableSpec,
} from "@/features/reporting/components/designer/layout";
import { findElementLocation } from "@/features/reporting/components/designer/layoutOps";
import {
  distributeWidthsEvenly,
  mergeCellWithNext,
  setCell,
  setColumnCount,
  setRowCount,
  splitCell,
} from "@/features/reporting/components/designer/tableOps";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";
import { BLOCK_LABELS } from "@/features/reporting/components/designer/layout";

function numberOrUndefined(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * The property editor for whatever's currently selected on the canvas -
 * page settings, a row's spacing/background, or one element's own content
 * and style. Every field here maps onto a value `ReportLayoutValidator`
 * whitelists server-side (colors, font sizes, margins) - this panel doesn't
 * invent styling latitude the backend can't actually honor, per the CSS-2.1
 * constraint documented throughout this feature.
 */
export function InspectorPanel({ editor }: { editor: LayoutEditor }) {
  const { selection } = editor;

  if (!selection) {
    return <p className="text-sm text-slate-500">Select a row or element on the canvas to edit its properties.</p>;
  }
  if (selection.type === "page") {
    return <PageInspector editor={editor} />;
  }
  if (selection.type === "row") {
    return <RowInspector editor={editor} rowId={selection.rowId} />;
  }
  return <ElementInspector editor={editor} elementId={selection.elementId} />;
}

function PageInspector({ editor }: { editor: LayoutEditor }) {
  const { page } = editor.layout;
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Page</h3>
      <FormField label="Font family" htmlFor="page-font-family">
        <Select
          id="page-font-family"
          value={page.fontFamily}
          onChange={(e) => editor.updatePage({ ...page, fontFamily: e.target.value as (typeof ALLOWED_FONT_FAMILIES)[number] })}
        >
          {ALLOWED_FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Font size (px)" htmlFor="page-font-size">
        <Input
          id="page-font-size"
          type="number"
          min={8}
          max={48}
          value={page.fontSizePx}
          onChange={(e) => editor.updatePage({ ...page, fontSizePx: Number(e.target.value) })}
        />
      </FormField>
      <FormField label="Padding (px)" htmlFor="page-padding">
        <Input
          id="page-padding"
          type="number"
          min={0}
          max={64}
          value={page.paddingPx}
          onChange={(e) => editor.updatePage({ ...page, paddingPx: Number(e.target.value) })}
        />
      </FormField>
      <FormField label="Text color" htmlFor="page-color">
        <Input id="page-color" type="color" value={page.color} onChange={(e) => editor.updatePage({ ...page, color: e.target.value })} />
      </FormField>
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox
            checked={page.logoBackground ?? false}
            onChange={(e) =>
              editor.updatePage({
                ...page,
                logoBackground: e.target.checked,
                logoBackgroundOpacity: page.logoBackgroundOpacity ?? 10,
              })
            }
          />
          Use school logo as background
        </label>
        <p className="text-xs text-slate-500">Schools without a logo on file render without a background.</p>
      </div>
      {page.logoBackground && (
        <FormField label="Background opacity (%)" htmlFor="page-bg-opacity">
          <Input
            id="page-bg-opacity"
            type="number"
            min={1}
            max={100}
            value={page.logoBackgroundOpacity ?? 10}
            onChange={(e) => editor.updatePage({ ...page, logoBackgroundOpacity: Number(e.target.value) })}
          />
        </FormField>
      )}
    </div>
  );
}

function RowInspector({ editor, rowId }: { editor: LayoutEditor; rowId: string }) {
  const row = editor.layout.rows.find((r) => r.id === rowId);
  if (!row) return null;
  const style = row.style ?? {};

  function set(patch: Partial<typeof style>) {
    editor.updateRowStyle(rowId, { ...style, ...patch });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Row</h3>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Margin top (px)" htmlFor="row-margin-top">
          <Input
            id="row-margin-top"
            type="number"
            min={0}
            max={64}
            value={style.marginTopPx ?? ""}
            onChange={(e) => set({ marginTopPx: numberOrUndefined(e.target.value) })}
          />
        </FormField>
        <FormField label="Margin bottom (px)" htmlFor="row-margin-bottom">
          <Input
            id="row-margin-bottom"
            type="number"
            min={0}
            max={64}
            value={style.marginBottomPx ?? ""}
            onChange={(e) => set({ marginBottomPx: numberOrUndefined(e.target.value) })}
          />
        </FormField>
      </div>
      <FormField label="Padding (px)" htmlFor="row-padding">
        <Input
          id="row-padding"
          type="number"
          min={0}
          max={64}
          value={style.paddingPx ?? ""}
          onChange={(e) => set({ paddingPx: numberOrUndefined(e.target.value) })}
        />
      </FormField>
      <FormField label="Background color" htmlFor="row-background">
        <div className="flex items-center gap-2">
          <Input
            id="row-background"
            type="color"
            value={style.backgroundColor ?? "#ffffff"}
            onChange={(e) => set({ backgroundColor: e.target.value })}
          />
          {style.backgroundColor && (
            <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => set({ backgroundColor: undefined })}>
              Clear
            </button>
          )}
        </div>
      </FormField>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={style.borderTop ?? false} onChange={(e) => set({ borderTop: e.target.checked })} />
        Border above
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={style.borderBottom ?? false} onChange={(e) => set({ borderBottom: e.target.checked })} />
        Border below
      </label>
    </div>
  );
}

function ElementInspector({ editor, elementId }: { editor: LayoutEditor; elementId: string }) {
  const location = findElementLocation(editor.layout, elementId);
  if (!location) return null;
  const element = location.element;
  const style: ElementStyle = element.style ?? {};

  function setStyle(patch: Partial<ElementStyle>) {
    editor.updateElement(elementId, { style: { ...style, ...patch } } as Partial<LayoutElement>);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {element.type === "BLOCK" ? BLOCK_LABELS[element.block] : element.type.charAt(0) + element.type.slice(1).toLowerCase()}
      </h3>

      {element.type === "TEXT" && (
        <>
          <FormField label="Text" htmlFor="element-text">
            <Textarea
              id="element-text"
              rows={3}
              value={element.text}
              onChange={(e) => editor.updateElement(elementId, { text: e.target.value } as Partial<LayoutElement>)}
            />
          </FormField>
          <FormField label="Alignment" htmlFor="element-align">
            <Select id="element-align" value={style.align ?? "left"} onChange={(e) => setStyle({ align: e.target.value as ElementStyle["align"] })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </Select>
          </FormField>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={style.bold ?? false} onChange={(e) => setStyle({ bold: e.target.checked })} />
              Bold
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={style.italic ?? false} onChange={(e) => setStyle({ italic: e.target.checked })} />
              Italic
            </label>
          </div>
          <FormField label="Font size (px)" htmlFor="element-font-size">
            <Input
              id="element-font-size"
              type="number"
              min={8}
              max={48}
              value={style.fontSizePx ?? ""}
              onChange={(e) => setStyle({ fontSizePx: numberOrUndefined(e.target.value) })}
            />
          </FormField>
          <FormField label="Text color" htmlFor="element-color">
            <Input id="element-color" type="color" value={style.color ?? "#1a1a1a"} onChange={(e) => setStyle({ color: e.target.value })} />
          </FormField>
        </>
      )}

      {element.type === "DIVIDER" && (
        <FormField label="Line color" htmlFor="divider-color">
          <Input id="divider-color" type="color" value={style.color ?? "#cccccc"} onChange={(e) => setStyle({ color: e.target.value })} />
        </FormField>
      )}

      {element.type === "SPACER" && (
        <FormField label="Height (px)" htmlFor="spacer-height">
          <Input
            id="spacer-height"
            type="number"
            min={1}
            max={200}
            value={element.heightPx}
            onChange={(e) => editor.updateElement(elementId, { heightPx: Number(e.target.value) } as Partial<LayoutElement>)}
          />
        </FormField>
      )}

      {element.type === "IMAGE" && (
        <>
          <ImageUploadField
            label="Image"
            fileId={element.fileId || undefined}
            onChange={(fileId) => editor.updateElement(elementId, { fileId: fileId ?? "" } as Partial<LayoutElement>)}
          />
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Max width (px)" htmlFor="image-max-width">
              <Input
                id="image-max-width"
                type="number"
                min={1}
                max={1000}
                value={element.maxWidthPx ?? ""}
                onChange={(e) => editor.updateElement(elementId, { maxWidthPx: numberOrUndefined(e.target.value) } as Partial<LayoutElement>)}
              />
            </FormField>
            <FormField label="Max height (px)" htmlFor="image-max-height">
              <Input
                id="image-max-height"
                type="number"
                min={1}
                max={1000}
                value={element.maxHeightPx ?? ""}
                onChange={(e) => editor.updateElement(elementId, { maxHeightPx: numberOrUndefined(e.target.value) } as Partial<LayoutElement>)}
              />
            </FormField>
          </div>
        </>
      )}

      {element.type === "BOX" && (
        <>
          <FormField label="Background color" htmlFor="box-background">
            <div className="flex items-center gap-2">
              <Input
                id="box-background"
                type="color"
                value={style.backgroundColor ?? "#ffffff"}
                onChange={(e) => setStyle({ backgroundColor: e.target.value })}
              />
              {style.backgroundColor && (
                <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setStyle({ backgroundColor: undefined })}>
                  Clear
                </button>
              )}
            </div>
          </FormField>
          <FormField label="Padding (px)" htmlFor="box-padding">
            <Input
              id="box-padding"
              type="number"
              min={0}
              max={64}
              value={style.paddingPx ?? ""}
              onChange={(e) => setStyle({ paddingPx: numberOrUndefined(e.target.value) })}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={style.border ?? false} onChange={(e) => setStyle({ border: e.target.checked })} />
            Show border
          </label>
        </>
      )}

      {element.type === "TABLE" && (
        <TableInspector editor={editor} elementId={elementId} table={element.table} />
      )}

      {element.type === "BLOCK" && SIZABLE_BLOCKS.has(element.block) && (
        <>
          <FormField label="Alignment" htmlFor="block-align">
            <Select id="block-align" value={style.align ?? "left"} onChange={(e) => setStyle({ align: e.target.value as ElementStyle["align"] })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Max width (px)" htmlFor="block-max-width">
              <Input
                id="block-max-width"
                type="number"
                min={1}
                max={1000}
                value={element.maxWidthPx ?? ""}
                onChange={(e) => editor.updateElement(elementId, { maxWidthPx: numberOrUndefined(e.target.value) } as Partial<LayoutElement>)}
              />
            </FormField>
            <FormField label="Max height (px)" htmlFor="block-max-height">
              <Input
                id="block-max-height"
                type="number"
                min={1}
                max={1000}
                value={element.maxHeightPx ?? ""}
                onChange={(e) => editor.updateElement(elementId, { maxHeightPx: numberOrUndefined(e.target.value) } as Partial<LayoutElement>)}
              />
            </FormField>
          </div>
        </>
      )}

      {element.type === "BLOCK" && <p className="text-xs text-slate-500">Filled automatically at render time - only its position is yours to arrange.</p>}

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
        <FormField label="Margin top (px)" htmlFor="element-margin-top">
          <Input
            id="element-margin-top"
            type="number"
            min={0}
            max={64}
            value={style.marginTopPx ?? ""}
            onChange={(e) => setStyle({ marginTopPx: numberOrUndefined(e.target.value) })}
          />
        </FormField>
        <FormField label="Margin bottom (px)" htmlFor="element-margin-bottom">
          <Input
            id="element-margin-bottom"
            type="number"
            min={0}
            max={64}
            value={style.marginBottomPx ?? ""}
            onChange={(e) => setStyle({ marginBottomPx: numberOrUndefined(e.target.value) })}
          />
        </FormField>
      </div>
    </div>
  );
}

function TableInspector({
  editor,
  elementId,
  table,
}: {
  editor: LayoutEditor;
  elementId: string;
  table: TableSpec;
}) {
  function set(next: typeof table) {
    editor.updateElement(elementId, { table: next } as Partial<LayoutElement>);
  }

  const widthSum = table.columnWidthsPercent?.reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Rows" htmlFor="table-rows">
          <Input
            id="table-rows"
            type="number"
            min={1}
            max={MAX_TABLE_ROWS}
            value={table.rows.length}
            onChange={(e) => set(setRowCount(table, Number(e.target.value)))}
          />
        </FormField>
        <FormField label="Columns" htmlFor="table-columns">
          <Input
            id="table-columns"
            type="number"
            min={1}
            max={MAX_TABLE_COLUMNS}
            value={table.columnCount}
            onChange={(e) => set(setColumnCount(table, Number(e.target.value)))}
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={table.headerRow ?? false} onChange={(e) => set({ ...table, headerRow: e.target.checked })} />
        First row is a header
      </label>
      {table.headerRow && (
        <FormField label="Header background" htmlFor="table-header-bg">
          <div className="flex items-center gap-2">
            <Input
              id="table-header-bg"
              type="color"
              value={table.headerBackgroundColor ?? "#f2f2f2"}
              onChange={(e) => set({ ...table, headerBackgroundColor: e.target.value })}
            />
            {table.headerBackgroundColor && (
              <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => set({ ...table, headerBackgroundColor: undefined })}>
                Clear
              </button>
            )}
          </div>
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-2">
        <FormField label="Border width (px)" htmlFor="table-border-width">
          <Input
            id="table-border-width"
            type="number"
            min={0}
            max={8}
            value={table.borderWidthPx ?? 1}
            onChange={(e) => set({ ...table, borderWidthPx: Number(e.target.value) })}
          />
        </FormField>
        <FormField label="Border style" htmlFor="table-border-style">
          <Select
            id="table-border-style"
            value={table.borderStyle ?? "solid"}
            onChange={(e) => set({ ...table, borderStyle: e.target.value as (typeof TABLE_BORDER_STYLES)[number] })}
          >
            {TABLE_BORDER_STYLES.map((style) => (
              <option key={style} value={style}>
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField label="Border color" htmlFor="table-border-color">
        <div className="flex items-center gap-2">
          <Input
            id="table-border-color"
            type="color"
            value={table.borderColor ?? "#cccccc"}
            onChange={(e) => set({ ...table, borderColor: e.target.value })}
          />
          {table.borderColor && (
            <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => set({ ...table, borderColor: undefined })}>
              Clear
            </button>
          )}
        </div>
      </FormField>
      <FormField label="Cell padding (px)" htmlFor="table-cell-padding">
        <Input
          id="table-cell-padding"
          type="number"
          min={0}
          max={24}
          value={table.cellPaddingPx ?? 4}
          onChange={(e) => set({ ...table, cellPaddingPx: Number(e.target.value) })}
        />
      </FormField>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Column widths</span>
          <button type="button" className="text-xs text-brand-600 hover:text-brand-700" onClick={() => set(distributeWidthsEvenly(table))}>
            Distribute evenly
          </button>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${table.columnCount}, minmax(0, 1fr))` }}>
          {Array.from({ length: table.columnCount }, (_, index) => (
            <Input
              key={index}
              type="number"
              min={1}
              max={100}
              aria-label={`Column ${index + 1} width (%)`}
              value={table.columnWidthsPercent?.[index] ?? ""}
              placeholder="auto"
              onChange={(e) => {
                const widths = table.columnWidthsPercent
                  ? table.columnWidthsPercent.slice()
                  : Array.from({ length: table.columnCount }, () => Math.round(100 / table.columnCount));
                widths[index] = Number(e.target.value);
                set({ ...table, columnWidthsPercent: widths });
              }}
            />
          ))}
        </div>
        {widthSum !== undefined && widthSum !== 100 && (
          <p className="mt-1 text-xs text-amber-800">Column widths must sum to 100 (currently {widthSum}).</p>
        )}
      </div>

      {editor.selectedCell?.elementId === elementId && (
        <SelectedCellInspector editor={editor} elementId={elementId} table={table} row={editor.selectedCell.row} col={editor.selectedCell.col} />
      )}
    </>
  );
}

function SelectedCellInspector({
  editor,
  elementId,
  table,
  row,
  col,
}: {
  editor: LayoutEditor;
  elementId: string;
  table: TableSpec;
  row: number;
  col: number;
}) {
  const cell: TableCell | undefined = table.rows[row]?.cells[col];
  if (!cell) return null;

  function setCellPatch(patch: Partial<TableCell>) {
    editor.updateElement(elementId, { table: setCell(table, row, col, patch) } as Partial<LayoutElement>);
  }

  const colSpan = cell.colSpan ?? 1;
  const cellsInRow = table.rows[row]?.cells.length ?? 0;
  const canMerge = col < cellsInRow - 1;

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Selected cell (row {row + 1}, col {col + 1})
      </span>
      <FormField label="Alignment" htmlFor="table-cell-align">
        <Select id="table-cell-align" value={cell.align ?? "left"} onChange={(e) => setCellPatch({ align: e.target.value as TableCell["align"] })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </Select>
      </FormField>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={cell.bold ?? false} onChange={(e) => setCellPatch({ bold: e.target.checked })} />
        Bold
      </label>
      <FormField label="Background color" htmlFor="table-cell-bg">
        <div className="flex items-center gap-2">
          <Input
            id="table-cell-bg"
            type="color"
            value={cell.backgroundColor ?? "#ffffff"}
            onChange={(e) => setCellPatch({ backgroundColor: e.target.value })}
          />
          {cell.backgroundColor && (
            <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setCellPatch({ backgroundColor: undefined })}>
              Clear
            </button>
          )}
        </div>
      </FormField>
      <div className="flex gap-2">
        {colSpan > 1 && (
          <button
            type="button"
            className="text-xs text-brand-600 hover:text-brand-700"
            onClick={() => editor.updateElement(elementId, { table: splitCell(table, row, col) } as Partial<LayoutElement>)}
          >
            Split (colspan {colSpan} &rarr; {colSpan - 1})
          </button>
        )}
        {canMerge && (
          <button
            type="button"
            className="text-xs text-brand-600 hover:text-brand-700"
            onClick={() => editor.updateElement(elementId, { table: mergeCellWithNext(table, row, col) } as Partial<LayoutElement>)}
          >
            Merge with next cell
          </button>
        )}
      </div>
    </div>
  );
}
