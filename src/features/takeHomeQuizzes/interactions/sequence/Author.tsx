import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { RichTextField } from "@/components/richText/RichTextField";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { blankSequenceItem } from "./defaults";
import {
  MAX_SEQUENCE_CAPTION_LENGTH,
  MAX_SEQUENCE_ITEMS,
  type SequenceConfig,
  type SequenceItem,
  type SequencePresentation,
} from "./types";

interface SequenceAuthorProps {
  value: SequenceConfig;
  onChange(config: SequenceConfig): void;
  disabled: boolean;
  answerOnly?: boolean;
  idPrefix: string;
}

/**
 * Authors a sequence: the items in their correct order (students always see them shuffled), each
 * with an optional caption - a date, say - that only shows in review. `answerOnly` leaves only the
 * reordering, which is the answer.
 */
export function SequenceAuthor({ value, onChange, disabled, answerOnly = false, idPrefix }: SequenceAuthorProps) {
  const items = value.items;
  const layoutDisabled = disabled || answerOnly;

  function setItems(next: SequenceItem[]) {
    onChange({ ...value, items: next });
  }

  function updateAt(index: number, patch: Partial<SequenceItem>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function swap(from: number, to: number) {
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    setItems(next);
  }

  return (
    <div className="space-y-3">
      <FormField label="Shown as" htmlFor={`${idPrefix}-presentation`} className="max-w-xs">
        <Select
          id={`${idPrefix}-presentation`}
          value={value.presentation}
          onChange={(event) => onChange({ ...value, presentation: event.target.value as SequencePresentation })}
          disabled={layoutDisabled}
        >
          <option value="LIST">A list</option>
          <option value="TIMELINE">A timeline</option>
        </Select>
      </FormField>
      <FormField label="Items, in the correct order">
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
              >
                {index + 1}
              </span>
              <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_10rem]">
                <RichTextField
                  value={item.html}
                  onChange={(html) => updateAt(index, { html })}
                  singleLine
                  allowImages
                  disabled={layoutDisabled}
                  ariaLabel={`Item ${index + 1}`}
                />
                <Input
                  value={item.caption ?? ""}
                  onChange={(event) => updateAt(index, { caption: event.target.value || null })}
                  maxLength={MAX_SEQUENCE_CAPTION_LENGTH}
                  placeholder="Caption (optional)"
                  aria-label={`Item ${index + 1} caption, shown only in review`}
                  disabled={layoutDisabled}
                />
              </div>
              {!disabled && (
                <div className="flex shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Move item ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => swap(index, index - 1)}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Move item ${index + 1} down`}
                    disabled={index === items.length - 1}
                    onClick={() => swap(index, index + 1)}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  {!answerOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      </FormField>
      {!layoutDisabled && items.length < MAX_SEQUENCE_ITEMS && (
        <Button type="button" variant="secondary" size="sm" onClick={() => setItems([...items, blankSequenceItem()])}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add item
        </Button>
      )}
    </div>
  );
}
