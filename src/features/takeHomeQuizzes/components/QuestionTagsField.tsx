import { X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { MAX_QUESTION_TAG_LENGTH, MAX_QUESTION_TAGS } from "@/features/takeHomeQuizzes/editableQuestion";
import { TAKE_HOME_QUIZ_FIELD_HELP } from "@/features/takeHomeQuizzes/takeHomeQuizFieldHelp";
import { useParticipantNoun } from "@/components/ParticipantNoun";

interface QuestionTagsFieldProps {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

/**
 * A question's staff-only topic tags. Enter or a comma adds one, lower-cased the way the server
 * stores it (backend `TakeHomeQuizQuestion`), so what the author sees is what gets saved.
 */
export function QuestionTagsField({ id, tags, onChange, disabled = false }: QuestionTagsFieldProps) {
  const { adapt } = useParticipantNoun();
  const [draft, setDraft] = useState("");
  const full = tags.length >= MAX_QUESTION_TAGS;

  function commit(raw: string) {
    const tag = raw.trim().toLowerCase();
    setDraft("");
    if (tag === "" || tags.includes(tag) || full) return;
    onChange([...tags, tag]);
  }

  return (
    <FormField label="Topic tags" htmlFor={id} description={adapt(TAKE_HOME_QUIZ_FIELD_HELP.tags)}>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <Badge key={tag} className="gap-1">
            {tag}
            {!disabled && (
              <button
                type="button"
                className="rounded-full text-slate-500 hover:text-slate-800"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(tags.filter((existing) => existing !== tag))}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </Badge>
        ))}
        {!disabled && !full && (
          <Input
            id={id}
            className="w-48"
            value={draft}
            maxLength={MAX_QUESTION_TAG_LENGTH}
            placeholder="Add a tag"
            onChange={(event) => {
              const value = event.target.value;
              if (value.includes(",")) {
                commit(value.replace(/,/g, ""));
              } else {
                setDraft(value);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit(draft);
              }
            }}
            onBlur={() => commit(draft)}
          />
        )}
      </div>
    </FormField>
  );
}
