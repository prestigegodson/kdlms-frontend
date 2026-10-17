import { Plus, X } from "lucide-react";
import { RichTextField } from "@/components/richText/RichTextField";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { describeLabel } from "../shared/labels";
import { blankMatchingLeft, blankMatchingRight } from "./defaults";
import { MAX_MATCHING_LEFTS, MAX_MATCHING_RIGHTS, type MatchingConfig, type MatchingLeft } from "./types";

interface MatchingAuthorProps {
  value: MatchingConfig;
  onChange(config: MatchingConfig): void;
  disabled: boolean;
  answerOnly?: boolean;
  idPrefix: string;
}

/**
 * Authors a matching question: the answers (an answer no prompt uses is a distractor), then each
 * prompt with the answer it matches. Students see the answers shuffled. `answerOnly` leaves only
 * which answer each prompt matches.
 */
export function MatchingAuthor({ value, onChange, disabled, answerOnly = false, idPrefix }: MatchingAuthorProps) {
  const { lefts, rights } = value;
  const layoutDisabled = disabled || answerOnly;

  function updateLeft(index: number, patch: Partial<MatchingLeft>) {
    onChange({ ...value, lefts: lefts.map((left, i) => (i === index ? { ...left, ...patch } : left)) });
  }

  function addPair() {
    const right = blankMatchingRight();
    onChange({ ...value, rights: [...rights, right], lefts: [...lefts, blankMatchingLeft(right.id)] });
  }

  function removeRight(index: number) {
    const removed = rights[index].id;
    onChange({
      ...value,
      rights: rights.filter((_, i) => i !== index),
      lefts: lefts.map((left) => (left.rightId === removed ? { ...left, rightId: null } : left)),
    });
  }

  return (
    <div className="space-y-4">
      <FormField label="Answers">
        <ul className="space-y-2">
          {rights.map((right, index) => (
            <li key={right.id} className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-sm font-semibold text-slate-500">{letter(index)}</span>
              <div className="flex-1">
                <RichTextField
                  value={right.html}
                  onChange={(html) =>
                    onChange({ ...value, rights: rights.map((r, i) => (i === index ? { ...r, html } : r)) })
                  }
                  singleLine
                  allowImages
                  disabled={layoutDisabled}
                  ariaLabel={`Answer ${letter(index)}`}
                />
              </div>
              {!layoutDisabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove answer ${letter(index)}`}
                  onClick={() => removeRight(index)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {!layoutDisabled && rights.length < MAX_MATCHING_RIGHTS && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => onChange({ ...value, rights: [...rights, blankMatchingRight()] })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a distractor answer
          </Button>
        )}
      </FormField>

      <FormField label="Prompts, each with the answer it matches">
        <ul className="space-y-2">
          {lefts.map((left, index) => (
            <li key={left.id} className="grid items-start gap-2 sm:grid-cols-[1fr_12rem_auto]">
              <RichTextField
                value={left.html}
                onChange={(html) => updateLeft(index, { html })}
                singleLine
                allowImages
                disabled={layoutDisabled}
                ariaLabel={`Prompt ${index + 1}`}
              />
              <Select
                value={left.rightId ?? ""}
                onChange={(event) => updateLeft(index, { rightId: event.target.value || null })}
                disabled={disabled}
                aria-label={`Prompt ${index + 1} matches`}
              >
                <option value="">Matches...</option>
                {rights.map((right, rightIndex) => (
                  <option key={right.id} value={right.id}>
                    {letter(rightIndex)}. {describeLabel(right.html, "(image)")}
                  </option>
                ))}
              </Select>
              {!layoutDisabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove prompt ${index + 1}`}
                  onClick={() => onChange({ ...value, lefts: lefts.filter((_, i) => i !== index) })}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {!layoutDisabled && lefts.length < MAX_MATCHING_LEFTS && rights.length < MAX_MATCHING_RIGHTS && (
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addPair}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a prompt and its answer
          </Button>
        )}
      </FormField>

      <label htmlFor={`${idPrefix}-reuse`} className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox
          id={`${idPrefix}-reuse`}
          checked={value.reuseRights}
          onChange={(event) => onChange({ ...value, reuseRights: event.target.checked })}
          disabled={layoutDisabled}
        />
        One answer can match more than one prompt
      </label>
    </div>
  );
}

function letter(index: number): string {
  return String.fromCharCode(65 + index);
}
