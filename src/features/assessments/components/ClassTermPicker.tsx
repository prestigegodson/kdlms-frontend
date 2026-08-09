import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { type AcademicSessionView, listSessions, listTerms, type TermView } from "@/api/sessions";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";

export interface ClassOption {
  id: string;
  name: string;
}

interface ClassTermPickerProps {
  classes: ClassOption[];
  classId: string;
  onClassChange: (classId: string) => void;
  termId: string;
  onTermChange: (termId: string, termNumber: number) => void;
  /**
   * An extra field rendered as a trailing cell in the same responsive grid -
   * e.g. `TeacherEntryPanel`'s Subject select - so a caller with a fourth
   * field doesn't need a second row of its own.
   */
  children?: ReactNode;
}

/**
 * Class + session + term selection, shared by the teacher entry panel and
 * the admin results panel - the one component in this feature that fetches
 * its own reference data rather than taking it as a prop (see
 * `features/academics/components/LevelSelect.tsx` for the usual
 * presentational-only convention). Both callers need identical session/term
 * cascading and there's no existing store for it beyond
 * `academicContextStore`'s admin-only display label, so this owns it once
 * rather than duplicating the fetch in both panels.
 */
export function ClassTermPicker({
  classes,
  classId,
  onClassChange,
  termId,
  onTermChange,
  children,
}: ClassTermPickerProps) {
  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [terms, setTerms] = useState<TermView[]>([]);

  useEffect(() => {
    listSessions(0, 50).then((page) => {
      setSessions(page.content);
      const current = page.content.find((session) => session.current);
      if (current) setSessionId(current.id);
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    listTerms(sessionId).then((fetchedTerms) => {
      setTerms(fetchedTerms);
      const current = fetchedTerms.find((term) => term.current);
      if (current) onTermChange(current.id, current.termNumber);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the session changes; onTermChange defaults to that session's current term
  }, [sessionId]);

  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none lg:gap-4">
      <FormField label="Class" htmlFor="picker-class" labelClassName="sr-only lg:not-sr-only">
        <Select id="picker-class" value={classId} onChange={(event) => onClassChange(event.target.value)}>
          <option value="">Select a class…</option>
          {classes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Session" htmlFor="picker-session" labelClassName="sr-only lg:not-sr-only">
        <Select id="picker-session" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Term" htmlFor="picker-term" labelClassName="sr-only lg:not-sr-only">
        <Select
          id="picker-term"
          value={termId}
          onChange={(event) => {
            const term = terms.find((candidate) => candidate.id === event.target.value);
            if (term) onTermChange(term.id, term.termNumber);
          }}
        >
          <option value="">Select a term…</option>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </Select>
      </FormField>
      {children}
    </div>
  );
}
