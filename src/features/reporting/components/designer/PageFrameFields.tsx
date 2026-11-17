import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ColorField } from "@/features/reporting/components/designer/ColorField";
import { FRAME_STYLES, type FrameStyle, type PageStyle } from "@/features/reporting/components/designer/layout";

/** What a newly switched-on frame starts as: a thin solid border in the page's own text colour, with a small gap. */
const DEFAULT_FRAME_WIDTH_PX = 2;
const DEFAULT_FRAME_GAP_PX = 6;

const FRAME_STYLE_LABELS: Record<FrameStyle, string> = {
  solid: "Solid",
  double: "Double",
  dashed: "Dashed",
  dotted: "Dotted",
};

/**
 * The page-border controls - see `PageFrame`. The border and its gap come out
 * of the page padding, so switching a frame on raises the padding if it is
 * too small to hold one, rather than leaving the designer with a validation
 * error they didn't cause.
 */
export function PageFrameFields({ page, onChange }: { page: PageStyle; onChange: (next: PageStyle) => void }) {
  const frame = page.frame;

  function toggle(on: boolean) {
    if (!on) {
      onChange({ ...page, frame: undefined });
      return;
    }
    const needed = DEFAULT_FRAME_WIDTH_PX + DEFAULT_FRAME_GAP_PX;
    onChange({
      ...page,
      paddingPx: Math.max(page.paddingPx, needed),
      frame: { widthPx: DEFAULT_FRAME_WIDTH_PX, style: "solid", color: page.color, gapPx: DEFAULT_FRAME_GAP_PX },
    });
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={frame !== undefined} onChange={(e) => toggle(e.target.checked)} />
        Border around the page
      </label>
      {frame && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Width (px)" htmlFor="page-frame-width">
              <Input
                id="page-frame-width"
                type="number"
                min={1}
                max={12}
                value={frame.widthPx}
                onChange={(e) => onChange({ ...page, frame: { ...frame, widthPx: Number(e.target.value) } })}
              />
            </FormField>
            <FormField label="Style" htmlFor="page-frame-style">
              <Select
                id="page-frame-style"
                value={frame.style}
                onChange={(e) => {
                  const style = e.target.value as FrameStyle;
                  // A double line needs 3px to draw; widen a thinner frame rather than fail validation.
                  const widthPx = style === "double" ? Math.max(frame.widthPx, 3) : frame.widthPx;
                  const paddingPx = Math.max(page.paddingPx, widthPx + (frame.gapPx ?? 0));
                  onChange({ ...page, paddingPx, frame: { ...frame, style, widthPx } });
                }}
              >
                {FRAME_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {FRAME_STYLE_LABELS[style]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              id="page-frame-color"
              label="Color"
              value={frame.color}
              fallback={page.color}
              onChange={(color) => onChange({ ...page, frame: { ...frame, color: color ?? page.color } })}
              clearLabel="Use text color"
            />
            <FormField label="Gap to content (px)" htmlFor="page-frame-gap">
              <Input
                id="page-frame-gap"
                type="number"
                min={0}
                max={40}
                value={frame.gapPx ?? 0}
                onChange={(e) => onChange({ ...page, frame: { ...frame, gapPx: Number(e.target.value) } })}
              />
            </FormField>
          </div>
          <p className="text-xs text-slate-500">
            The border and gap sit inside the page padding ({page.paddingPx}px), so the content area doesn't change.
          </p>
        </>
      )}
    </div>
  );
}
