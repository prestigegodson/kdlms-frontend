import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import type { EditableAnswerKey } from "@/features/takeHomeQuizzes/editableQuestion";

interface FillInTheGapFieldProps {
  answerKeys: EditableAnswerKey[];
  onChange: (answerKeys: EditableAnswerKey[]) => void;
  disabled?: boolean;
}

/**
 * The expected answer for a `FILL_IN_THE_GAP` question. v1 always saves
 * exactly one row (`TakeHomeQuizValidator` requires exactly one non-blank
 * answer key), so this is a single field rather than a repeatable list -
 * see quiz-module.md's "Fill-in-the-gap forward compatibility" for why the
 * *table* already supports more, deferred to a later phase.
 */
export function FillInTheGapField({ answerKeys, onChange, disabled = false }: FillInTheGapFieldProps) {
  const first = answerKeys[0] ?? { key: crypto.randomUUID(), id: null, expectedAnswer: "" };

  function updateAnswer(expectedAnswer: string) {
    onChange([{ ...first, expectedAnswer }]);
  }

  return (
    <FormField
      label="Expected answer"
      htmlFor="fill-in-the-gap-answer"
      description="Matched case-insensitively, with whitespace trimmed and collapsed - exact wording otherwise."
    >
      <Input
        id="fill-in-the-gap-answer"
        value={first.expectedAnswer}
        onChange={(event) => updateAnswer(event.target.value)}
        disabled={disabled}
      />
    </FormField>
  );
}
