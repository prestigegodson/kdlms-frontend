import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

export interface WeightingValues {
  quizWeight: number;
  examWeight: number;
  quizMax: number;
  examMax: number;
}

interface WeightingFieldsProps {
  values: WeightingValues;
  onChange: (values: WeightingValues) => void;
}

/** Quiz/exam weighting (must sum to 100) and raw-mark ceilings for a NUMERIC grading system. */
export function WeightingFields({ values, onChange }: WeightingFieldsProps) {
  const weightSum = values.quizWeight + values.examWeight;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Quiz weight (%)" htmlFor="quiz-weight">
          <Input
            id="quiz-weight"
            type="number"
            min={0}
            max={100}
            required
            value={values.quizWeight}
            onChange={(event) => onChange({ ...values, quizWeight: Number(event.target.value) })}
          />
        </FormField>
        <FormField label="Exam weight (%)" htmlFor="exam-weight">
          <Input
            id="exam-weight"
            type="number"
            min={0}
            max={100}
            required
            value={values.examWeight}
            onChange={(event) => onChange({ ...values, examWeight: Number(event.target.value) })}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Quiz max mark" htmlFor="quiz-max">
          <Input
            id="quiz-max"
            type="number"
            min={0.01}
            step="any"
            required
            value={values.quizMax}
            onChange={(event) => onChange({ ...values, quizMax: Number(event.target.value) })}
          />
        </FormField>
        <FormField label="Exam max mark" htmlFor="exam-max">
          <Input
            id="exam-max"
            type="number"
            min={0.01}
            step="any"
            required
            value={values.examMax}
            onChange={(event) => onChange({ ...values, examMax: Number(event.target.value) })}
          />
        </FormField>
      </div>
      {weightSum !== 100 && (
        <p className="text-xs text-red-600">Quiz and exam weight must sum to 100 (currently {weightSum}).</p>
      )}
    </div>
  );
}
