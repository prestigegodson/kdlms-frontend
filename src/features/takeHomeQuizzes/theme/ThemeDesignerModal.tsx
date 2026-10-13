import { Monitor, Smartphone } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { ApiError } from "@/api/client";
import {
  createQuizTheme,
  type QuizThemeFont,
  type QuizThemeStyle,
  type QuizThemeView,
  type ThemeBackgroundKind,
  type ThemeCardRadius,
  updateQuizTheme,
} from "@/api/quizThemes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { readableAccent } from "@/features/takeHomeQuizzes/theme/themeColors";
import { loadThemeFont, THEME_FONTS } from "@/features/takeHomeQuizzes/theme/themeFonts";
import { type PreviewScreen, ThemePreview } from "@/features/takeHomeQuizzes/theme/ThemePreview";

export interface ThemeDraft {
  name: string;
  style: QuizThemeStyle;
}

interface ThemeDesignerModalProps {
  /** What the form starts from - a blank theme, a duplicate, or the theme being edited. */
  initial: ThemeDraft;
  /** Set when editing an existing theme; its `usageCount` drives the "changes apply to N quizzes" note. */
  editing?: QuizThemeView;
  /** Offer "Save & use on this quiz" - off when the editor is read-only. */
  canUse: boolean;
  quizTitle?: string;
  onClose: () => void;
  onSaved: (theme: QuizThemeView, use: boolean) => void;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const SWATCHES = ["#3b4fd9", "#0ea5e9", "#16a34a", "#f59e0b", "#dc2626", "#be185d", "#7c3aed", "#0f172a"];
const BACKGROUND_KINDS: Array<{ value: ThemeBackgroundKind; label: string }> = [
  { value: "SOLID", label: "Colour" },
  { value: "GRADIENT", label: "Gradient" },
  { value: "IMAGE", label: "Image" },
];
const RADII: Array<{ value: ThemeCardRadius; label: string }> = [
  { value: "NONE", label: "Square" },
  { value: "SMALL", label: "Small" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LARGE", label: "Round" },
];

/**
 * Creates or edits a quiz theme with a live preview beside the form - the preview is the real
 * `QuizThemeFrame` on sample content, so it is exactly what students will see. Readability is
 * automatic (see `themeColors.ts`), so the form never needs to warn about contrast; it only says so
 * when it has quietly darkened the accent.
 */
export function ThemeDesignerModal({ initial, editing, canUse, quizTitle, onClose, onSaved }: ThemeDesignerModalProps) {
  const [name, setName] = useState(initial.name);
  const [style, setStyle] = useState<QuizThemeStyle>(initial.style);
  const [screen, setScreen] = useState<PreviewScreen>("start");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState<"save" | "use" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const fontId = useId();

  function patch(next: Partial<QuizThemeStyle>) {
    setStyle((current) => ({ ...current, ...next }));
  }

  function chooseKind(kind: ThemeBackgroundKind) {
    patch({
      backgroundKind: kind,
      backgroundColor2: kind === "GRADIENT" ? (style.backgroundColor2 ?? "#1e3a8a") : style.backgroundColor2,
      gradientAngle: kind === "GRADIENT" ? (style.gradientAngle ?? 135) : style.gradientAngle,
      backgroundImageFit: kind === "IMAGE" ? (style.backgroundImageFit ?? "COVER") : style.backgroundImageFit,
    });
  }

  function chooseFont(font: QuizThemeFont) {
    loadThemeFont(font);
    patch({ font });
  }

  const problem = !name.trim()
    ? "Give the theme a name."
    : style.backgroundKind === "IMAGE" && !style.backgroundImageFileId
      ? "Upload a background image, or choose a colour background."
      : null;

  async function save(use: boolean) {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(use ? "use" : "save");
    setError(null);
    try {
      const request = { name: name.trim(), style: normalized(style) };
      const saved = editing ? await updateQuizTheme(editing.id, request) : await createQuizTheme(request);
      onSaved(saved, use);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this theme");
    } finally {
      setSaving(null);
    }
  }

  const accentAdjusted = HEX.test(style.accentColor) && readableAccent(style.accentColor) !== style.accentColor.toLowerCase();

  return (
    <Modal open onClose={onClose} title={editing ? "Edit theme" : "Create theme"} size="xxl" fullScreenOnMobile>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}
          {editing && editing.usageCount > 0 && (
            <Alert variant="info">
              Changes apply to {editing.usageCount} quiz{editing.usageCount === 1 ? "" : "zes"} immediately.
            </Alert>
          )}

          <FormField label="Name" htmlFor={nameId}>
            <Input
              id={nameId}
              value={name}
              maxLength={60}
              placeholder="e.g. Sports day"
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-700">Background</legend>
            <Segmented
              label="Background type"
              value={style.backgroundKind}
              options={BACKGROUND_KINDS}
              onChange={chooseKind}
            />
            <ColorField
              label={style.backgroundKind === "IMAGE" ? "Colour while the image loads" : style.backgroundKind === "GRADIENT" ? "From" : "Colour"}
              value={style.backgroundColor}
              onChange={(backgroundColor) => patch({ backgroundColor })}
            />
            {style.backgroundKind === "GRADIENT" && (
              <>
                <ColorField
                  label="To"
                  value={style.backgroundColor2 ?? "#1e3a8a"}
                  onChange={(backgroundColor2) => patch({ backgroundColor2 })}
                />
                <RangeField
                  label="Direction"
                  value={style.gradientAngle ?? 135}
                  min={0}
                  max={360}
                  step={15}
                  suffix="°"
                  onChange={(gradientAngle) => patch({ gradientAngle })}
                />
              </>
            )}
            {style.backgroundKind === "IMAGE" && (
              <>
                <ImageUploadField
                  label="Background image"
                  fileId={style.backgroundImageFileId ?? undefined}
                  onChange={(fileId) => patch({ backgroundImageFileId: fileId ?? null })}
                />
                <Segmented
                  label="Image fit"
                  value={style.backgroundImageFit ?? "COVER"}
                  options={[
                    { value: "COVER", label: "Fill the page" },
                    { value: "TILE", label: "Repeat as a pattern" },
                  ]}
                  onChange={(backgroundImageFit) => patch({ backgroundImageFit })}
                />
              </>
            )}
          </fieldset>

          <div className="space-y-1">
            <ImageUploadField
              label="Header image (optional)"
              fileId={style.headerImageFileId ?? undefined}
              onChange={(fileId) => patch({ headerImageFileId: fileId ?? null })}
            />
            <p className="text-xs text-slate-500">A wide banner shown above the quiz - about 1200 × 300 works best.</p>
          </div>

          <div className="space-y-1">
            <ColorField
              label="Accent colour"
              value={style.accentColor}
              onChange={(accentColor) => patch({ accentColor })}
            />
            <p className="text-xs text-slate-500">
              {accentAdjusted
                ? "This colour is darkened a little on buttons so their text stays readable."
                : "Used for buttons, progress and selected answers."}
            </p>
          </div>

          <FormField label="Font" htmlFor={fontId}>
            <Select id={fontId} value={style.font} onChange={(event) => chooseFont(event.target.value as QuizThemeFont)}>
              {(Object.keys(THEME_FONTS) as QuizThemeFont[]).map((font) => (
                <option key={font} value={font}>
                  {THEME_FONTS[font].label}
                </option>
              ))}
            </Select>
          </FormField>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-700">Question card</legend>
            <RangeField
              label="Opacity"
              value={style.cardOpacity}
              min={85}
              max={100}
              step={1}
              suffix="%"
              onChange={(cardOpacity) => patch({ cardOpacity })}
            />
            <Segmented
              label="Corners"
              value={style.cardRadius}
              options={RADII}
              onChange={(cardRadius) => patch({ cardRadius })}
            />
          </fieldset>
        </div>

        <div className="space-y-3 md:sticky md:top-0 md:self-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              label="Preview screen"
              value={screen}
              options={[
                { value: "start", label: "Start page" },
                { value: "question", label: "Question" },
              ]}
              onChange={setScreen}
            />
            <div className="flex gap-1" role="group" aria-label="Preview size">
              <IconToggle label="Desktop preview" pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
                <Monitor className="h-4 w-4" aria-hidden="true" />
              </IconToggle>
              <IconToggle label="Mobile preview" pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
                <Smartphone className="h-4 w-4" aria-hidden="true" />
              </IconToggle>
            </div>
          </div>
          <div className="rounded-card border border-slate-200 bg-slate-50 p-2">
            <div className={device === "mobile" ? "mx-auto max-w-[340px]" : undefined}>
              <ThemePreview style={normalized(style)} screen={screen} title={quizTitle || undefined} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={canUse ? "secondary" : "primary"} onClick={() => save(false)} loading={saving === "save"} disabled={saving !== null}>
          Save theme
        </Button>
        {canUse && (
          <Button onClick={() => save(true)} loading={saving === "use"} disabled={saving !== null}>
            Save &amp; use on this quiz
          </Button>
        )}
      </div>
    </Modal>
  );
}

/** Drops the fields the background kind doesn't use, the way the server stores them - so the preview matches. */
function normalized(style: QuizThemeStyle): QuizThemeStyle {
  return {
    ...style,
    backgroundColor2: style.backgroundKind === "GRADIENT" ? style.backgroundColor2 : null,
    gradientAngle: style.backgroundKind === "GRADIENT" ? style.gradientAngle : null,
    backgroundImageFileId: style.backgroundKind === "IMAGE" ? style.backgroundImageFileId : null,
    backgroundImageFit: style.backgroundKind === "IMAGE" ? (style.backgroundImageFit ?? "COVER") : null,
  };
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-control border border-slate-300 bg-white p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-[5px] px-3 py-1.5 text-sm font-medium mobile:min-h-11 ${
            value === option.value ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function IconToggle({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-control border mobile:h-11 mobile:w-11 ${
        pressed ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

/** A colour picker plus a hex field and a row of style-guide swatches; only a valid `#rrggbb` reaches `onChange`. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }
  const id = useId();
  const invalid = !HEX.test(text);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm text-slate-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-control border border-slate-300 bg-white p-0.5 mobile:h-11"
        />
        <Input
          id={id}
          value={text}
          maxLength={7}
          aria-invalid={invalid}
          className="w-28 font-mono"
          onChange={(event) => {
            const next = event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`;
            setText(next);
            if (HEX.test(next)) onChange(next.toLowerCase());
          }}
        />
        <div className="flex flex-wrap gap-1">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use ${swatch}`}
              onClick={() => onChange(swatch)}
              className="h-6 w-6 rounded-full border border-white shadow ring-1 ring-slate-300"
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}

function RangeField({ label, value, min, max, step, suffix, onChange }: RangeFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm text-slate-700">
        <label htmlFor={id}>{label}</label>
        <span className="tabular-nums text-slate-500">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-brand-500"
      />
    </div>
  );
}
