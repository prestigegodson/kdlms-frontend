import { useEffect, useState } from "react";
import { type LevelView, listLevels } from "@/api/levels";
import { type AcademicSessionView, listSessions, listTerms, type TermView } from "@/api/sessions";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { useFilterChip } from "@/components/ui/StickySubHeader";

interface LevelTermPickerProps {
  levelId: string;
  onLevelChange: (levelId: string) => void;
  sessionId: string;
  onSessionChange: (sessionId: string) => void;
  termId: string;
  onTermChange: (termId: string) => void;
  /** Defaults to "Session". */
  sessionLabel?: string;
  /**
   * Whether an unselected session/term should default to the current one on load - the
   * `ClassTermPicker` behaviour. `BillsTab` wants it (the convenience it's replacing);
   * `AdvanceBillsTab` deliberately doesn't - advance billing exists specifically for a session
   * that isn't current yet, so it starts with everything unselected. Defaults to `false`.
   */
  defaultCurrentSession?: boolean;
  /** Distinguishes element ids when both `BillsTab` and `AdvanceBillsTab`'s pickers could otherwise collide. */
  idPrefix: string;
}

/**
 * Level + session + term selection, shared by `BillsTab` and `AdvanceBillsTab` (Phase 31, when
 * `BillsTab` itself became level-first) - the `ClassTermPicker` shape, but for a level rather than
 * a class, and with session/term lifted to the caller (both tabs need the raw `sessionId`, not
 * just the resolved term). Owns its own levels/sessions/terms fetch and filter-chip registration,
 * the `ClassTermPicker` convention.
 */
export function LevelTermPicker({
  levelId,
  onLevelChange,
  sessionId,
  onSessionChange,
  termId,
  onTermChange,
  sessionLabel = "Session",
  defaultCurrentSession = false,
  idPrefix,
}: LevelTermPickerProps) {
  const [levels, setLevels] = useState<LevelView[]>([]);
  useEffect(() => {
    listLevels().then((all) => setLevels(all.filter((level) => level.status === "ACTIVE")));
  }, []);

  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  useEffect(() => {
    listSessions(0, 50).then((page) => {
      setSessions(page.content);
      if (defaultCurrentSession && !sessionId) {
        const current = page.content.find((session) => session.current);
        if (current) onSessionChange(current.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only
  }, []);

  const [terms, setTerms] = useState<TermView[]>([]);
  // A session change clears this component's own `terms` list during render (self-owned state,
  // safe to update synchronously) so a stale session's terms never flash before the fetch below
  // lands. Clearing the CALLER's `termId` happens inside the effect instead - a child updating an
  // ancestor's state must happen in an effect, never during the child's own render.
  const [lastTermsSessionId, setLastTermsSessionId] = useState(sessionId);
  if (sessionId !== lastTermsSessionId) {
    setLastTermsSessionId(sessionId);
    setTerms([]);
  }
  useEffect(() => {
    if (!sessionId) {
      onTermChange("");
      return;
    }
    listTerms(sessionId).then((fetchedTerms) => {
      setTerms(fetchedTerms);
      if (defaultCurrentSession) {
        const preferred = fetchedTerms.find((term) => term.current) ?? fetchedTerms[0];
        onTermChange(preferred?.id ?? "");
      } else {
        onTermChange("");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the session changes
  }, [sessionId]);

  useFilterChip("level", levels.find((level) => level.id === levelId)?.displayName);
  useFilterChip("session", sessions.find((session) => session.id === sessionId)?.name);
  useFilterChip("term", terms.find((term) => term.id === termId)?.name);

  return (
    <div className="grid min-w-0 flex-1 gap-2 lg:grid-flow-col lg:auto-cols-fr lg:gap-4">
      <FormField label="Level" htmlFor={`${idPrefix}-level`}>
        <Select id={`${idPrefix}-level`} value={levelId} onChange={(event) => onLevelChange(event.target.value)}>
          <option value="">Select a level…</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.displayName}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={sessionLabel} htmlFor={`${idPrefix}-session`}>
        <Select
          id={`${idPrefix}-session`}
          value={sessionId}
          onChange={(event) => onSessionChange(event.target.value)}
        >
          <option value="">Select a session…</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Term" htmlFor={`${idPrefix}-term`}>
        <Select
          id={`${idPrefix}-term`}
          value={termId}
          onChange={(event) => onTermChange(event.target.value)}
          disabled={!sessionId}
        >
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
