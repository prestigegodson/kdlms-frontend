import { useEffect, useState } from "react";
import { type AcademicSessionView, listSessions, listTerms, type TermView } from "@/api/sessions";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { useFilterChip } from "@/components/ui/StickySubHeader";
import { LESSON_NOTE_STATUSES } from "@/features/lessonNotes/lessonNoteStatus";
import { useLevelStore } from "@/stores/levelStore";

interface ReviewQueueFiltersProps {
  levelId: string;
  onLevelChange: (levelId: string) => void;
  termId: string;
  onTermChange: (termId: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
}

/**
 * Level + Session/Term + Status filters for the admin review queue - unlike
 * `SubjectTermPicker`'s week-grid cascade (term is required there, defaulted
 * to the session's current one), every filter here is optional: "All
 * levels"/"All terms"/"All statuses" are real, selectable states, so
 * changing the session only narrows the term dropdown's option list and
 * resets the term filter rather than forcing it back onto a specific term.
 */
export function ReviewQueueFilters({
  levelId,
  onLevelChange,
  termId,
  onTermChange,
  status,
  onStatusChange,
}: ReviewQueueFiltersProps) {
  const levels = useLevelStore((state) => state.levels);
  const fetchLevels = useLevelStore((state) => state.fetchIfNeeded);

  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [terms, setTerms] = useState<TermView[]>([]);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  useEffect(() => {
    listSessions(0, 50).then((page) => {
      setSessions(page.content);
      const current = page.content.find((session) => session.current);
      if (current) setSessionId(current.id);
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    listTerms(sessionId).then(setTerms);
  }, [sessionId]);

  function handleSessionChange(nextSessionId: string) {
    setSessionId(nextSessionId);
    onTermChange("");
  }

  const statusLabel = LESSON_NOTE_STATUSES.find((option) => option.value === status)?.label ?? "All statuses";

  useFilterChip("level", levels.find((level) => level.id === levelId)?.displayName ?? "All levels");
  useFilterChip("term", terms.find((term) => term.id === termId)?.name ?? "All terms");
  useFilterChip("status", statusLabel);

  return (
    <div className="grid min-w-0 flex-1 gap-2 lg:grid-flow-col lg:auto-cols-fr lg:gap-4">
      <FormField label="Level" htmlFor="review-queue-level">
        <Select id="review-queue-level" value={levelId} onChange={(event) => onLevelChange(event.target.value)}>
          <option value="">All levels</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.displayName}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Session" htmlFor="review-queue-session">
        <Select id="review-queue-session" value={sessionId} onChange={(event) => handleSessionChange(event.target.value)}>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Term" htmlFor="review-queue-term">
        <Select id="review-queue-term" value={termId} onChange={(event) => onTermChange(event.target.value)}>
          <option value="">All terms</option>
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Status" htmlFor="review-queue-status">
        <Select id="review-queue-status" value={status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="">All statuses</option>
          {LESSON_NOTE_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}
