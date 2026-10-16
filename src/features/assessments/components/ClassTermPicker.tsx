import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { type AcademicSessionView, listSessions, listTerms, type TermView } from "@/api/sessions";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { useFilterChip } from "@/components/ui/StickySubHeader";

export interface ClassOption {
  id: string;
  name: string;
  /**
   * The class's level name. When any option carries one, the Class select groups its options under
   * one heading per level, in the order the levels first appear - so callers pass classes already
   * sorted by level rank (the class list endpoints' own order).
   */
  group?: string;
}

/** `classes` split into runs per level, in first-appearance order; `null` when no option names a level. */
function groupByLevel(classes: ClassOption[]): [string, ClassOption[]][] | null {
  if (!classes.some((option) => option.group)) return null;
  const groups = new Map<string, ClassOption[]>();
  for (const option of classes) {
    const key = option.group ?? "Other";
    const run = groups.get(key);
    if (run) run.push(option);
    else groups.set(key, [option]);
  }
  return Array.from(groups);
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
      // A previous session has no term flagged current - fall back to its
      // first term rather than leaving termId pointing at whatever the
      // prior session had selected (a blank Term select that never refetches).
      const preferred = fetchedTerms.find((term) => term.current) ?? fetchedTerms[0];
      onTermChange(preferred?.id ?? "", preferred?.termNumber ?? 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the session changes; onTermChange defaults to that session's current (or else first) term
  }, [sessionId]);

  useFilterChip("session", sessions.find((session) => session.id === sessionId)?.name);
  useFilterChip("term", terms.find((term) => term.id === termId)?.name);
  useFilterChip("class", classes.find((option) => option.id === classId)?.name);
  const levelGroups = groupByLevel(classes);
  const renderOption = (option: ClassOption) => (
    <option key={option.id} value={option.id}>
      {option.name}
    </option>
  );

  return (
    <div className="grid min-w-0 flex-1 gap-2 lg:grid-flow-col lg:auto-cols-fr lg:gap-4">
      <FormField label="Session" htmlFor="picker-session">
        <Select id="picker-session" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Term" htmlFor="picker-term">
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
      <FormField label="Class" htmlFor="picker-class">
        <Select id="picker-class" value={classId} onChange={(event) => onClassChange(event.target.value)}>
          <option value="">Select a class…</option>
          {levelGroups
            ? levelGroups.map(([level, options]) => (
                <optgroup key={level} label={level}>
                  {options.map(renderOption)}
                </optgroup>
              ))
            : classes.map(renderOption)}
        </Select>
      </FormField>
      {children}
    </div>
  );
}
