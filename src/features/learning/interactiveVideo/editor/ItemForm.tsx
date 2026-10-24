import { useState, type ReactNode } from "react";
import { ApiError } from "@/api/client";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_LABEL, uploadFile } from "@/api/files";
import type {
  InteractiveDisplayAs,
  InteractiveItem,
  InteractiveItemContent,
  InteractiveMandatory,
  InteractiveSize,
} from "@/api/learning";
import { RichTextField } from "@/components/richText/RichTextField";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { itemTypeLabel } from "../defaults";
import { formatTimecode, isGraded, isInteractive, parseTimecode } from "../engine";
import type { RenderImage } from "../player/ItemBody";

/** Mirrors backend `InteractiveVideo.MAX_OPTIONS`/`MAX_CHOICES`. */
const MAX_OPTIONS = 10;
const MAX_CHOICES = 6;
/** A TEXT item's embedded images count towards the resource's own image cap; keep each item modest. */
const MAX_TEXT_IMAGES = 5;

function newOptionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `opt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A seconds value edited as `m:ss` - committed on blur/Enter, so typing "1:" mid-way never
 * clobbers the value. `onNow` (when given) offers "Now" to take the editor's current time.
 */
function TimeField({
  id,
  label,
  value,
  onChange,
  onNow,
  allowEmpty = false,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (seconds: number | null) => void;
  onNow?: () => void;
  allowEmpty?: boolean;
}) {
  const shown = value == null ? "" : timecodeWithTenths(value);
  function commit(text: string) {
    const parsed = parseTimecode(text);
    if (parsed === null) {
      if (allowEmpty && text.trim() === "") {
        onChange(null);
      }
      return;
    }
    onChange(parsed);
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="flex gap-1">
        <Input
          key={shown}
          id={id}
          defaultValue={shown}
          placeholder={allowEmpty ? "—" : "0:00"}
          inputMode="decimal"
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit((event.target as HTMLInputElement).value);
            }
          }}
        />
        {onNow && (
          <Button type="button" size="sm" variant="secondary" onClick={onNow}>
            Now
          </Button>
        )}
      </div>
    </div>
  );
}

/** `m:ss`, plus `.t` tenths when the time isn't a whole second (a "Now" taken mid-playback). */
function timecodeWithTenths(seconds: number): string {
  const tenths = Math.round(seconds * 10);
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10;
  return formatTimecode(whole) + (fraction ? `.${fraction}` : "");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-slate-200 pt-3">
      <legend className="pr-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

function CheckRow({
  id,
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-slate-800">
        <Checkbox id={id} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
      {hint && <p className="ml-6 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/**
 * The selected item's options - the H5P interactive video "edit" pane: when it shows, how it
 * displays and whether it pauses or blocks the video, plus the type's own content. The form only
 * offers options the item's type accepts - the backend's `InteractiveVideo#normalize` refuses the
 * rest - and requiring a correct answer always keeps Retry on, so a student can't get stuck.
 */
export function ItemForm({
  item,
  currentTime,
  problems,
  renderImage,
  onChange,
  onDelete,
  onDuplicate,
}: {
  item: InteractiveItem;
  currentTime: number;
  problems: string[];
  renderImage: RenderImage;
  onChange: (patch: Partial<InteractiveItem>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const id = (field: string) => `iv-${item.id}-${field}`;
  const graded = isGraded(item.type);
  const interactive = isInteractive(item.type);
  const clickable = item.type === "TEXT" || item.type === "LABEL" || item.type === "IMAGE";
  const c = item.content;
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  function setContent(patch: Partial<InteractiveItemContent>) {
    onChange({ content: { ...c, ...patch } });
  }

  function setMandatory(mandatory: InteractiveMandatory) {
    onChange(mandatory === "CORRECT" ? { mandatory, enableRetry: true } : { mandatory });
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      setImageError(`Images can be at most ${MAX_IMAGE_UPLOAD_LABEL}.`);
      return;
    }
    setImageError(null);
    setUploadingImage(true);
    try {
      const stored = await uploadFile(file);
      setContent({ fileId: stored.fileId, alt: c.alt ?? stored.fileName.replace(/\.[^.]+$/, "") });
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Failed to upload the image");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-slate-900">{itemTypeLabel(item.type)}</h3>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button type="button" size="sm" variant="danger" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      {problems.length > 0 && (
        <ul className="space-y-1 rounded-control border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {/* The type's own content first - it's what the author came to write. */}
      <div className="space-y-3">
        {item.type === "TEXT" && (
          <RichTextField
            value={c.html ?? ""}
            onChange={(html) => setContent({ html })}
            allowImages
            maxImages={MAX_TEXT_IMAGES}
            ariaLabel="Text"
          />
        )}
        {item.type === "LABEL" && (
          <Input aria-label="Label text" value={c.text ?? ""} onChange={(event) => setContent({ text: event.target.value })} />
        )}
        {item.type === "IMAGE" && (
          <>
            {c.fileId && <div className="max-h-40 overflow-hidden">{renderImage(c.fileId, c.alt ?? "")}</div>}
            <input
              type="file"
              accept="image/*"
              aria-label="Upload image"
              disabled={uploadingImage}
              onChange={(event) => handleImage(event.target.files?.[0])}
            />
            {uploadingImage && <p className="text-xs text-slate-500">Uploading…</p>}
            {imageError && <p className="text-xs text-red-600">{imageError}</p>}
            <Input
              aria-label="Image description"
              placeholder="Describe the image (for screen readers)"
              value={c.alt ?? ""}
              onChange={(event) => setContent({ alt: event.target.value })}
            />
          </>
        )}
        {(item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE") && (
          <>
            <Textarea
              aria-label="Question"
              placeholder="Question"
              rows={2}
              value={c.question ?? ""}
              onChange={(event) => setContent({ question: event.target.value })}
            />
            <div className="space-y-2">
              {(c.options ?? []).map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    type={item.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                    name={id("correct")}
                    aria-label={`Option ${index + 1} is correct`}
                    checked={option.correct}
                    onChange={(event) =>
                      setContent({
                        options: (c.options ?? []).map((other) =>
                          other.id === option.id
                            ? { ...other, correct: event.target.checked }
                            : item.type === "SINGLE_CHOICE"
                              ? { ...other, correct: false }
                              : other,
                        ),
                      })
                    }
                    className="h-4 w-4 text-brand-500"
                  />
                  <Input
                    aria-label={`Option ${index + 1}`}
                    placeholder={`Option ${index + 1}`}
                    value={option.text ?? ""}
                    onChange={(event) =>
                      setContent({
                        options: (c.options ?? []).map((other) =>
                          other.id === option.id ? { ...other, text: event.target.value } : other,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() => setContent({ options: (c.options ?? []).filter((other) => other.id !== option.id) })}
                  >
                    ×
                  </Button>
                </div>
              ))}
              {(c.options ?? []).length < MAX_OPTIONS && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setContent({ options: [...(c.options ?? []), { id: newOptionId(), text: "", correct: false }] })
                  }
                >
                  Add option
                </Button>
              )}
              <p className="text-xs text-slate-500">
                {item.type === "SINGLE_CHOICE" ? "Select the one correct option." : "Tick every correct option."}
              </p>
            </div>
          </>
        )}
        {item.type === "TRUE_FALSE" && (
          <>
            <Textarea
              aria-label="Statement"
              placeholder="Statement"
              rows={2}
              value={c.question ?? ""}
              onChange={(event) => setContent({ question: event.target.value })}
            />
            <Select
              aria-label="Correct answer"
              value={c.answer === false ? "false" : "true"}
              onChange={(event) => setContent({ answer: event.target.value === "true" })}
            >
              <option value="true">The statement is true</option>
              <option value="false">The statement is false</option>
            </Select>
          </>
        )}
        {item.type === "FILL_BLANKS" && (
          <>
            <Textarea
              aria-label="Text with blanks"
              rows={4}
              placeholder="Water boils at *100/one hundred* degrees."
              value={c.text ?? ""}
              onChange={(event) => setContent({ text: event.target.value })}
            />
            <p className="text-xs text-slate-500">
              Wrap each answer in *asterisks*. Separate accepted alternatives with a slash: *colour/color*.
            </p>
            <CheckRow
              id={id("case")}
              label="Answers are case-sensitive"
              checked={c.caseSensitive === true}
              onChange={(caseSensitive) => setContent({ caseSensitive })}
            />
          </>
        )}
        {item.type === "FREE_TEXT" && (
          <>
            <Textarea
              aria-label="Question"
              placeholder="Question"
              rows={2}
              value={c.prompt ?? ""}
              onChange={(event) => setContent({ prompt: event.target.value })}
            />
            <Textarea
              aria-label="Model answer"
              placeholder="Model answer (shown after the student answers)"
              rows={3}
              value={c.modelAnswer ?? ""}
              onChange={(event) => setContent({ modelAnswer: event.target.value })}
            />
          </>
        )}
        {item.type === "LINK" && (
          <>
            <Input
              aria-label="Link text"
              placeholder="Link text"
              value={c.text ?? ""}
              onChange={(event) => setContent({ text: event.target.value })}
            />
            <Input
              aria-label="Link address"
              type="url"
              placeholder="https://"
              value={c.url ?? ""}
              onChange={(event) => setContent({ url: event.target.value })}
            />
          </>
        )}
        {item.type === "NAV_HOTSPOT" && (
          <div className="grid grid-cols-2 gap-2">
            <TimeField
              id={id("target")}
              label="Jumps to"
              value={c.targetSeconds}
              allowEmpty
              onChange={(targetSeconds) => setContent({ targetSeconds })}
              onNow={() => setContent({ targetSeconds: currentTime })}
            />
            <div>
              <label htmlFor={id("shape")} className="mb-1 block text-xs font-medium text-slate-600">
                Shape
              </label>
              <Select
                id={id("shape")}
                value={c.shape ?? "RECTANGLE"}
                onChange={(event) => setContent({ shape: event.target.value as "RECTANGLE" | "CIRCLE" })}
              >
                <option value="RECTANGLE">Rectangle</option>
                <option value="CIRCLE">Circle</option>
              </Select>
            </div>
          </div>
        )}
        {item.type === "CROSSROADS" && (
          <>
            <Textarea
              aria-label="Question"
              placeholder="Where would you like to go next?"
              rows={2}
              value={c.prompt ?? ""}
              onChange={(event) => setContent({ prompt: event.target.value })}
            />
            {(c.choices ?? []).map((choice, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
                <Input
                  aria-label={`Choice ${index + 1}`}
                  placeholder={`Choice ${index + 1}`}
                  value={choice.label ?? ""}
                  onChange={(event) =>
                    setContent({
                      choices: (c.choices ?? []).map((other, i) => (i === index ? { ...other, label: event.target.value } : other)),
                    })
                  }
                />
                <TimeField
                  id={id(`choice-${index}`)}
                  label="Jumps to"
                  value={choice.targetSeconds}
                  allowEmpty
                  onChange={(targetSeconds) =>
                    setContent({
                      choices: (c.choices ?? []).map((other, i) => (i === index ? { ...other, targetSeconds } : other)),
                    })
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove choice ${index + 1}`}
                  onClick={() => setContent({ choices: (c.choices ?? []).filter((_, i) => i !== index) })}
                >
                  ×
                </Button>
              </div>
            ))}
            {(c.choices ?? []).length < MAX_CHOICES && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setContent({ choices: [...(c.choices ?? []), { label: "", targetSeconds: null }] })}
              >
                Add choice
              </Button>
            )}
          </>
        )}
      </div>

      <Section title="Display time">
        <div className="grid grid-cols-2 gap-2">
          <TimeField
            id={id("start")}
            label="Start"
            value={item.start}
            onChange={(start) => start != null && onChange({ start, end: Math.max(item.end, start + 0.5) })}
            onNow={() => onChange({ start: currentTime, end: Math.max(item.end, currentTime + 0.5) })}
          />
          <TimeField
            id={id("end")}
            label="Stop"
            value={item.end}
            onChange={(end) => end != null && end > item.start && onChange({ end })}
            onNow={() => currentTime > item.start && onChange({ end: currentTime })}
          />
        </div>
        <CheckRow
          id={id("pause")}
          label="Pause the video when this appears"
          checked={item.pause}
          onChange={(pause) => onChange({ pause })}
        />
        {interactive && (
          <div>
            <label htmlFor={id("mandatory")} className="mb-1 block text-xs font-medium text-slate-600">
              Before the video continues
            </label>
            <Select
              id={id("mandatory")}
              value={item.mandatory}
              onChange={(event) => setMandatory(event.target.value as InteractiveMandatory)}
            >
              <option value="NONE">Nothing required</option>
              <option value="ANSWERED">It must be answered</option>
              {graded && <option value="CORRECT">It must be answered correctly</option>}
            </Select>
          </div>
        )}
      </Section>

      {item.type !== "NAV_HOTSPOT" && (
        <Section title="Appearance">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={id("display")} className="mb-1 block text-xs font-medium text-slate-600">
                Display as
              </label>
              <Select
                id={id("display")}
                value={item.displayAs}
                onChange={(event) => onChange({ displayAs: event.target.value as InteractiveDisplayAs })}
              >
                <option value="BUTTON">Button</option>
                <option value="POSTER">Poster</option>
              </Select>
            </div>
            <div>
              <label htmlFor={id("size")} className="mb-1 block text-xs font-medium text-slate-600">
                Button size
              </label>
              <Select
                id={id("size")}
                value={item.style?.size ?? "M"}
                disabled={item.displayAs !== "BUTTON"}
                onChange={(event) =>
                  onChange({ style: { ...defaultStyle(item), size: event.target.value as InteractiveSize } })
                }
              >
                <option value="S">Small</option>
                <option value="M">Medium</option>
                <option value="L">Large</option>
              </Select>
            </div>
          </div>
          <div>
            <label htmlFor={id("label")} className="mb-1 block text-xs font-medium text-slate-600">
              Button label
            </label>
            <Input
              id={id("label")}
              placeholder="Defaults to the question or text"
              value={item.style?.buttonLabel ?? ""}
              onChange={(event) => onChange({ style: { ...defaultStyle(item), buttonLabel: event.target.value || null } })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={id("bg")} className="flex items-center gap-2 text-sm text-slate-800">
              <input
                id={id("bg")}
                type="color"
                value={item.style?.background ?? "#ffffff"}
                disabled={item.style?.transparent === true}
                onChange={(event) => onChange({ style: { ...defaultStyle(item), background: event.target.value } })}
                className="h-8 w-10 rounded border border-slate-300"
              />
              Background
            </label>
            {item.style?.background && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange({ style: { ...defaultStyle(item), background: null } })}
              >
                Default
              </Button>
            )}
            <CheckRow
              id={id("transparent")}
              label="Transparent"
              checked={item.style?.transparent === true}
              onChange={(transparent) => onChange({ style: { ...defaultStyle(item), transparent } })}
            />
          </div>
        </Section>
      )}

      {clickable && (
        <Section title="When clicked">
          <Select
            aria-label="When clicked"
            value={item.goTo?.kind ?? "NONE"}
            onChange={(event) => {
              const kind = event.target.value;
              onChange({
                goTo: kind === "NONE" ? null : { kind: kind as "TIME" | "URL", seconds: kind === "TIME" ? currentTime : null, url: null },
              });
            }}
          >
            <option value="NONE">Do nothing</option>
            <option value="TIME">Jump to a time in the video</option>
            <option value="URL">Open a web page</option>
          </Select>
          {item.goTo?.kind === "TIME" && (
            <TimeField
              id={id("goto-time")}
              label="Jump to"
              value={item.goTo.seconds}
              allowEmpty
              onChange={(seconds) => onChange({ goTo: { kind: "TIME", seconds, url: null } })}
              onNow={() => onChange({ goTo: { kind: "TIME", seconds: currentTime, url: null } })}
            />
          )}
          {item.goTo?.kind === "URL" && (
            <Input
              aria-label="Web page address"
              type="url"
              placeholder="https://"
              value={item.goTo.url ?? ""}
              onChange={(event) => onChange({ goTo: { kind: "URL", seconds: null, url: event.target.value } })}
            />
          )}
        </Section>
      )}

      {graded && (
        <Section title="Feedback and behaviour">
          <Input
            aria-label="Feedback for a correct answer"
            placeholder="Feedback for a correct answer"
            value={item.feedback?.correct ?? ""}
            onChange={(event) => onChange({ feedback: { correct: event.target.value || null, wrong: item.feedback?.wrong ?? null } })}
          />
          <Input
            aria-label="Feedback for a wrong answer"
            placeholder="Feedback for a wrong answer"
            value={item.feedback?.wrong ?? ""}
            onChange={(event) => onChange({ feedback: { correct: item.feedback?.correct ?? null, wrong: event.target.value || null } })}
          />
          <CheckRow
            id={id("retry")}
            label="Allow retry"
            checked={item.enableRetry}
            disabled={item.mandatory === "CORRECT"}
            hint={item.mandatory === "CORRECT" ? "Always on when a correct answer is required." : undefined}
            onChange={(enableRetry) => onChange({ enableRetry })}
          />
          <CheckRow
            id={id("solution")}
            label='Show a "Show solution" button'
            checked={item.enableSolution}
            onChange={(enableSolution) => onChange({ enableSolution })}
          />
          <div className="grid grid-cols-2 gap-2">
            <TimeField
              id={id("on-correct")}
              label="If correct, jump to"
              value={item.adaptivity?.onCorrectSeconds ?? null}
              allowEmpty
              onChange={(onCorrectSeconds) =>
                onChange({ adaptivity: { onCorrectSeconds, onWrongSeconds: item.adaptivity?.onWrongSeconds ?? null } })
              }
            />
            <TimeField
              id={id("on-wrong")}
              label="If wrong, jump to"
              value={item.adaptivity?.onWrongSeconds ?? null}
              allowEmpty
              onChange={(onWrongSeconds) =>
                onChange({ adaptivity: { onCorrectSeconds: item.adaptivity?.onCorrectSeconds ?? null, onWrongSeconds } })
              }
            />
          </div>
          <p className="text-xs text-slate-500">Leave a jump blank to carry on playing. A wrong-answer jump back lets students re-watch the explanation.</p>
        </Section>
      )}
    </div>
  );
}

function defaultStyle(item: InteractiveItem) {
  return item.style ?? { buttonLabel: null, size: "M" as const, background: null, transparent: false };
}
