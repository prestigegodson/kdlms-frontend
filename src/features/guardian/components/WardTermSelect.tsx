import { useEffect, useState } from "react";
import { listWardTerms, type WardTermView } from "@/api/wards";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";

interface WardTermSelectProps {
  studentId: string;
  termId: string;
  onTermChange: (term: WardTermView) => void;
  emptyMessage: string;
}

/**
 * Term selection for one ward - fetches `GET /api/v1/me/wards/{id}/terms`
 * itself (mirrors `ClassTermPicker`'s self-contained-cascade convention)
 * rather than taking terms as a prop. Used by `WardAttendancePage` only -
 * the results drill-down (`WardResultsLayout`/`WardSessionsPage`/
 * `WardSessionTermsPage`/`WardTermResultPage`) fetches terms itself and
 * navigates through session/term as distinct routes instead of a dropdown.
 * Defaults to the current session's latest term, or the most recent one
 * otherwise - the backend returns newest session first.
 */
export function WardTermSelect({ studentId, termId, onTermChange, emptyMessage }: WardTermSelectProps) {
  const [terms, setTerms] = useState<WardTermView[] | null>(null);

  // A ward change resets the fetched list during render (the pattern
  // `ScoreEntryGrid`/`AdminResultsPanel` document) rather than inside the
  // effect below, which only fetches.
  const [lastStudentId, setLastStudentId] = useState(studentId);
  if (studentId !== lastStudentId) {
    setLastStudentId(studentId);
    setTerms(null);
  }

  useEffect(() => {
    listWardTerms(studentId).then((allTerms) => {
      setTerms(allTerms);
      const defaultTerm = [...allTerms].reverse().find((term) => term.currentSession) ?? allTerms[0] ?? null;
      if (defaultTerm) onTermChange(defaultTerm);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the ward changes; onTermChange is stable per caller
  }, [studentId]);

  if (terms === null) {
    return null;
  }
  if (terms.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <FormField label="Term" htmlFor="ward-term-selector" className="min-w-0 flex-1 lg:max-w-xs lg:flex-initial">
      <Select
        id="ward-term-selector"
        value={termId}
        onChange={(event) => {
          const term = terms.find((candidate) => candidate.termId === event.target.value);
          if (term) onTermChange(term);
        }}
      >
        {!termId && <option value="">Select a term</option>}
        {terms.map((term) => (
          <option key={term.termId} value={term.termId}>
            {term.termName} &middot; {term.sessionName}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
