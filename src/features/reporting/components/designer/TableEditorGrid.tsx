import { useRef, useState } from "react";
import type { LayoutElement, TableElement } from "@/features/reporting/components/designer/layout";
import { setCell } from "@/features/reporting/components/designer/tableOps";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

interface TableEditorGridProps {
  element: TableElement;
  editor: LayoutEditor;
  /** `ElementCard` toggles `draggable` off while a cell is focused, so native drag doesn't hijack text selection inside the textarea. */
  onInlineEditingChange: (editing: boolean) => void;
}

/**
 * Renders an approximation of the `<table>` `LayoutHtmlEmitter` would emit
 * (see that class for the real, authoritative markup), with each cell an
 * inline-editable `<textarea>` - the one element whose canvas rendering
 * needs `editor` for live editing rather than the stateless `ElementPreview`
 * every other free-form element uses.
 * <p>
 * A keystroke is held in local `drafts` state and only committed to the
 * layout on blur: `useLayoutEditor.commit` pushes an undo entry on every
 * call, and a per-keystroke commit would exhaust the 50-entry history in one
 * sentence of typing.
 */
export function TableEditorGrid({ element, editor, onInlineEditingChange }: TableEditorGridProps) {
  const { table } = element;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const discardOnBlurRef = useRef<Record<string, boolean>>({});

  function cellKey(row: number, col: number) {
    return `${row}-${col}`;
  }

  function valueAt(row: number, col: number, committed: string) {
    const draft = drafts[cellKey(row, col)];
    return draft !== undefined ? draft : committed;
  }

  function clearDraft(key: string) {
    setDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function commitCell(row: number, col: number) {
    const key = cellKey(row, col);
    const draft = drafts[key];
    if (draft !== undefined) {
      editor.updateElement(element.id, { table: setCell(table, row, col, { text: draft }) } as Partial<LayoutElement>);
    }
    clearDraft(key);
  }

  const borderWidth = table.borderWidthPx ?? 1;
  const borderStyle = table.borderStyle ?? "solid";
  const borderColor = table.borderColor ?? "#cccccc";
  const border = borderWidth === 0 || borderStyle === "none" ? "none" : `${borderWidth}px ${borderStyle} ${borderColor}`;
  const cellPadding = table.cellPaddingPx ?? 4;

  return (
    <table
      className="w-full table-fixed border-collapse text-xs"
      onMouseDown={(event) => event.stopPropagation()}
      onDragStart={(event) => event.stopPropagation()}
    >
      {table.columnWidthsPercent && (
        <colgroup>
          {table.columnWidthsPercent.map((width, index) => (
            <col key={index} style={{ width: `${width}%` }} />
          ))}
        </colgroup>
      )}
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={row.id}>
            {row.cells.map((cell, colIndex) => {
              const isHeader = Boolean(table.headerRow) && rowIndex === 0;
              const Tag = isHeader ? "th" : "td";
              const key = cellKey(rowIndex, colIndex);
              return (
                <Tag
                  key={key}
                  colSpan={cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined}
                  style={{
                    border,
                    padding: `${cellPadding}px`,
                    verticalAlign: "top",
                    textAlign: cell.align,
                    fontWeight: isHeader || cell.bold ? 700 : 400,
                    backgroundColor: isHeader ? (table.headerBackgroundColor ?? "#f2f2f2") : cell.backgroundColor,
                  }}
                >
                  <textarea
                    rows={1}
                    value={valueAt(rowIndex, colIndex, cell.text)}
                    placeholder="Empty cell"
                    className="w-full resize-none border-0 bg-transparent p-0 text-xs leading-snug focus:outline-none"
                    onFocus={() => {
                      onInlineEditingChange(true);
                      editor.setSelection({ type: "element", elementId: element.id });
                      editor.setSelectedCell({ elementId: element.id, row: rowIndex, col: colIndex });
                    }}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                    onBlur={() => {
                      if (discardOnBlurRef.current[key]) {
                        discardOnBlurRef.current[key] = false;
                        clearDraft(key);
                      } else {
                        commitCell(rowIndex, colIndex);
                      }
                      onInlineEditingChange(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        discardOnBlurRef.current[key] = true;
                        event.currentTarget.blur();
                      }
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onDragStart={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  />
                </Tag>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
