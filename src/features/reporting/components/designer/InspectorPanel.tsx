import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ALLOWED_FONT_FAMILIES, type ElementStyle, type LayoutElement } from "@/features/reporting/components/designer/layout";
import { findElementLocation } from "@/features/reporting/components/designer/layoutOps";
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

      {element.type === "BLOCK" && element.block === "STUDENT_PHOTO" && (
        <>
          <FormField label="Alignment" htmlFor="photo-align">
            <Select id="photo-align" value={style.align ?? "left"} onChange={(e) => setStyle({ align: e.target.value as ElementStyle["align"] })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Max width (px)" htmlFor="photo-max-width">
              <Input
                id="photo-max-width"
                type="number"
                min={1}
                max={1000}
                value={element.maxWidthPx ?? ""}
                onChange={(e) => editor.updateElement(elementId, { maxWidthPx: numberOrUndefined(e.target.value) } as Partial<LayoutElement>)}
              />
            </FormField>
            <FormField label="Max height (px)" htmlFor="photo-max-height">
              <Input
                id="photo-max-height"
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
