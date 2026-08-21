import { useEffect, useState } from "react";
import { type AcademicSessionView, listSessions, listTerms, type TermView } from "@/api/sessions";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { useFilterChip } from "@/components/ui/StickySubHeader";

export interface SubjectOption {
  id: string;
  name: string;
  /** Shown alongside the subject name where the caller's subjects span several levels (the admin catalogue). */
  levelName?: string;
}

interface SubjectTermPickerProps {
  subjects: SubjectOption[];
  subjectId: string;
  onSubjectChange: (subjectId: string) => void;
  termId: string;
  onTermChange: (termId: string) => void;
}

/**
 * Subject + session + term selection - the lesson-notes counterpart to
 * `features/assessments/components/ClassTermPicker.tsx`, which it mirrors
 * for the session/term cascade (fetches its own reference data, defaults to
 * the current session/term). Subjects are supplied by the caller rather
 * than fetched here, since the two lesson-notes panels source their subject
 * list differently (a teacher's own `/me/lesson-note-subjects` vs. the
 * admin catalogue's `listSubjects()`).
 */
export function SubjectTermPicker({
  subjects,
  subjectId,
  onSubjectChange,
  termId,
  onTermChange,
}: SubjectTermPickerProps) {
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
      const preferred = fetchedTerms.find((term) => term.current) ?? fetchedTerms[0];
      onTermChange(preferred?.id ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the session changes; onTermChange defaults to that session's current (or else first) term
  }, [sessionId]);

  useFilterChip("session", sessions.find((session) => session.id === sessionId)?.name);
  useFilterChip("term", terms.find((term) => term.id === termId)?.name);
  useFilterChip("subject", subjects.find((option) => option.id === subjectId)?.name);

  return (
    <div className="grid min-w-0 flex-1 gap-2 lg:grid-flow-col lg:auto-cols-fr lg:gap-4">
      <FormField label="Subject" htmlFor="lesson-note-picker-subject">
        <Select
          id="lesson-note-picker-subject"
          value={subjectId}
          onChange={(event) => onSubjectChange(event.target.value)}
        >
          <option value="">Select a subject…</option>
          {subjects.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.levelName ? ` (${option.levelName})` : ""}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Session" htmlFor="lesson-note-picker-session">
        <Select
          id="lesson-note-picker-session"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Term" htmlFor="lesson-note-picker-term">
        <Select id="lesson-note-picker-term" value={termId} onChange={(event) => onTermChange(event.target.value)}>
          <option value="">Select a term…</option>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}
