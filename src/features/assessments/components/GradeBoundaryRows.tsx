import type { GradeBoundary } from "@/api/gradingSystems";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

interface GradeBoundaryRowsProps {
  boundaries: GradeBoundary[];
  onChange: (boundaries: GradeBoundary[]) => void;
}

const BLANK_BOUNDARY: GradeBoundary = { grade: "", minScore: 0, maxScore: 0, remark: "" };

/**
 * The letter-grade band editor for a NUMERIC grading system - each row is
 * grade/min/max/remark; together they must be non-overlapping and cover
 * 0-100 with no gaps (validated client-side by the editor page before
 * submit, and re-validated by the backend regardless).
 */
export function GradeBoundaryRows({ boundaries, onChange }: GradeBoundaryRowsProps) {
  function updateRow(index: number, patch: Partial<GradeBoundary>) {
    onChange(boundaries.map((boundary, i) => (i === index ? { ...boundary, ...patch } : boundary)));
  }

  function addRow() {
    onChange([...boundaries, BLANK_BOUNDARY]);
  }

  function removeRow(index: number) {
    onChange(boundaries.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Grade boundaries</h3>
        <button type="button" className="text-sm text-brand-500 hover:text-brand-600" onClick={addRow}>
          Add boundary
        </button>
      </div>

      {boundaries.length === 0 && <p className="text-sm text-slate-500">No boundaries yet - add at least one.</p>}

      <div className="space-y-3">
        {boundaries.map((boundary, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-3 rounded-control border border-slate-200 p-3 sm:grid-cols-5 sm:items-end"
          >
            <FormField label="Grade" htmlFor={`boundary-${index}-grade`}>
              <Input
                id={`boundary-${index}-grade`}
                required
                value={boundary.grade}
                onChange={(event) => updateRow(index, { grade: event.target.value })}
              />
            </FormField>
            <FormField label="Min score" htmlFor={`boundary-${index}-min`}>
              <Input
                id={`boundary-${index}-min`}
                type="number"
                min={0}
                max={100}
                step="any"
                required
                value={boundary.minScore}
                onChange={(event) => updateRow(index, { minScore: Number(event.target.value) })}
              />
            </FormField>
            <FormField label="Max score" htmlFor={`boundary-${index}-max`}>
              <Input
                id={`boundary-${index}-max`}
                type="number"
                min={0}
                max={100}
                step="any"
                required
                value={boundary.maxScore}
                onChange={(event) => updateRow(index, { maxScore: Number(event.target.value) })}
              />
            </FormField>
            <FormField label="Remark" htmlFor={`boundary-${index}-remark`}>
              <Input
                id={`boundary-${index}-remark`}
                required
                value={boundary.remark}
                onChange={(event) => updateRow(index, { remark: event.target.value })}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={() => removeRow(index)}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
