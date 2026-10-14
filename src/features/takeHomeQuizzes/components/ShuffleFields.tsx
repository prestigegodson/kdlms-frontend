import { Checkbox } from "@/components/ui/Checkbox";
import { TAKE_HOME_QUIZ_FIELD_HELP } from "@/features/takeHomeQuizzes/takeHomeQuizFieldHelp";
import { useParticipantNoun } from "@/components/ParticipantNoun";

interface ShuffleFieldsProps {
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  onChange: (value: { shuffleQuestions: boolean; shuffleChoices: boolean }) => void;
  /** Locked once a submission exists - a changed order would reshuffle an attempt mid-way. */
  disabled: boolean;
}

/** The quiz's two randomisation toggles - shared by the school and creator quiz editors. */
export function ShuffleFields({ shuffleQuestions, shuffleChoices, onChange, disabled }: ShuffleFieldsProps) {
  const { adapt } = useParticipantNoun();
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox
          checked={shuffleQuestions}
          onChange={(event) => onChange({ shuffleQuestions: event.target.checked, shuffleChoices })}
          disabled={disabled}
        />
        Shuffle question order
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox
          checked={shuffleChoices}
          onChange={(event) => onChange({ shuffleQuestions, shuffleChoices: event.target.checked })}
          disabled={disabled}
        />
        Shuffle answer choices
      </label>
      <p className="text-xs text-slate-500">{adapt(TAKE_HOME_QUIZ_FIELD_HELP.shuffle)}</p>
    </div>
  );
}
