import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { THEME_PRESETS, applyTheme } from "@/features/reporting/components/designer/themePresets";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

const CUSTOM = "custom";

/**
 * Applies a colour scheme to the whole template in one undoable step - see
 * `themePresets.ts`. A theme only fills in ordinary colour fields, so the
 * designer can keep adjusting any of them afterwards.
 */
export function ThemePicker({ editor }: { editor: LayoutEditor }) {
  const [presetId, setPresetId] = useState(THEME_PRESETS[0].id);
  const [customAccent, setCustomAccent] = useState("#1f3a8a");
  const accent = presetId === CUSTOM ? customAccent : (THEME_PRESETS.find((preset) => preset.id === presetId)?.accent ?? customAccent);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <FormField label="Color theme" htmlFor="theme-preset">
          <Select id="theme-preset" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {THEME_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value={CUSTOM}>Custom color…</option>
          </Select>
        </FormField>
        {presetId === CUSTOM ? (
          <Input
            aria-label="Theme accent color"
            type="color"
            className="h-9 w-12 cursor-pointer p-1"
            value={customAccent}
            onChange={(e) => setCustomAccent(e.target.value)}
          />
        ) : (
          <span aria-hidden="true" className="mb-1 h-7 w-7 rounded-control border border-slate-200" style={{ backgroundColor: accent }} />
        )}
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={() => editor.replaceLayout(applyTheme(editor.layout, accent))}>
        Apply theme
      </Button>
      <p className="text-xs text-slate-500">Sets the table, border and school name colors. You can still change any of them after (or undo).</p>
    </div>
  );
}
