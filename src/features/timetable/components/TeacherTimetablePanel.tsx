import { useEffect, useState } from "react";
import { type AcademicSessionView, listSessions, listTerms, type TermView } from "@/api/sessions";
import { ApiError } from "@/api/client";
import {
  type ClassTimetableView,
  getMyClassTimetables,
  getMyTimetable,
  type MyTimetableEntryView,
  type TeacherWeekView,
} from "@/api/timetable";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { TimetableGrid } from "@/components/TimetableGrid";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";
import { formatClockTime } from "@/utils/date";
import { CalendarDays } from "lucide-react";

const DAY_NAMES: Record<number, string> = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday" };
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7];

type TimetableTab = "my" | "class";

/**
 * A TEACHER's own timetable - CLAUDE.md's "one page, two tabs" UX. "My
 * timetable" (every scheduled period, across every class) is always
 * available, sourced entirely from `GET /api/v1/me/timetable`; "Class
 * timetable" (the full week grid, reusing `TimetableGrid` read-only - the
 * "one component, two callers" precedent `AttendanceSummaryPanel`/
 * `ThreadCard` already set) renders only for a class teacher
 * (`teacherScopeStore.capabilities.isClassTeacher`), never for a
 * subject-teacher-only account. Session/term selection is plain (two
 * fields), so it docks in a non-collapsible `StickySubHeader` per that
 * component's own guidance.
 */
export function TeacherTimetablePanel() {
  const capabilities = useTeacherScopeStore((state) => state.capabilities);
  const isClassTeacher = capabilities?.isClassTeacher ?? false;

  const [tab, setTab] = useState<TimetableTab>("my");
  // Never actually render the Class tab for a non-class-teacher, even if `tab`
  // was left at "class" from an earlier class-teacher assignment - a derived
  // value during render rather than an effect calling setState.
  const activeTab: TimetableTab = isClassTeacher ? tab : "my";

  const [sessions, setSessions] = useState<AcademicSessionView[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [terms, setTerms] = useState<TermView[]>([]);
  const [termId, setTermId] = useState("");

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
      setTermId(preferred?.id ?? "");
    });
  }, [sessionId]);

  const [week, setWeek] = useState<TeacherWeekView | null>(null);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [classViews, setClassViews] = useState<ClassTimetableView[] | null>(null);
  const [classViewsError, setClassViewsError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");

  // A term change resets downstream state during render (the AdminTimetablePanel/
  // ScoreEntryGrid idiom) rather than inside an effect; the effects below only fetch.
  const [lastTermId, setLastTermId] = useState(termId);
  if (termId !== lastTermId) {
    setLastTermId(termId);
    setWeek(null);
    setWeekError(null);
    setClassViews(null);
    setClassViewsError(null);
    setSelectedClassId("");
  }

  useEffect(() => {
    if (!termId) return;
    getMyTimetable(termId)
      .then(setWeek)
      .catch((error: unknown) => setWeekError(error instanceof ApiError ? error.message : "Failed to load your timetable"));
  }, [termId]);

  useEffect(() => {
    if (!termId || activeTab !== "class" || !isClassTeacher) return;
    getMyClassTimetables(termId)
      .then((views) => {
        setClassViews(views);
        setSelectedClassId((current) => (views.some((view) => view.classId === current) ? current : views[0]?.classId ?? ""));
      })
      .catch((error: unknown) =>
        setClassViewsError(error instanceof ApiError ? error.message : "Failed to load your class timetable"),
      );
  }, [termId, activeTab, isClassTeacher]);

  const selectedClassView = classViews?.find((view) => view.classId === selectedClassId) ?? null;
  const entriesByDay = groupByDay(week?.entries ?? []);

  return (
    <div className="space-y-6">
      <PageHeader title="Timetable" description="Your own weekly schedule." />

      <StickySubHeader>
        <FormField label="Session" htmlFor="my-timetable-session" className="min-w-0 flex-1 lg:max-w-xs">
          <Select id="my-timetable-session" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Term" htmlFor="my-timetable-term" className="min-w-0 flex-1 lg:max-w-xs">
          <Select
            id="my-timetable-term"
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
          >
            <option value="">Select a term…</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </Select>
        </FormField>
      </StickySubHeader>

      {isClassTeacher && (
        <div role="tablist" aria-label="Timetable views" className="flex gap-1 border-b border-slate-200">
          <TabButton label="My timetable" active={activeTab === "my"} onClick={() => setTab("my")} />
          <TabButton label="Class timetable" active={activeTab === "class"} onClick={() => setTab("class")} />
        </div>
      )}

      {!termId && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading terms…
        </div>
      )}

      {termId && activeTab === "my" && (
        <>
          {weekError && <Alert variant="error">{weekError}</Alert>}
          {!week && !weekError && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading your timetable…
            </div>
          )}
          {week && week.entries.length === 0 && (
            <EmptyState
              icon={CalendarDays}
              title="No periods scheduled"
              description="You have no scheduled periods for this term yet."
            />
          )}
          {week && week.entries.length > 0 && (
            <div className="space-y-4">
              {DAY_ORDER.filter((day) => entriesByDay.has(day)).map((day) => (
                <Card key={day}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">{DAY_NAMES[day]}</h3>
                  <div className="divide-y divide-slate-100">
                    {(entriesByDay.get(day) ?? []).map((entry) => (
                      <TimetableAgendaRow key={entry.entryId} entry={entry} />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {termId && activeTab === "class" && isClassTeacher && (
        <>
          {classViewsError && <Alert variant="error">{classViewsError}</Alert>}
          {!classViews && !classViewsError && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading your class timetable…
            </div>
          )}
          {classViews && classViews.length === 0 && (
            <EmptyState
              icon={CalendarDays}
              title="No period grid yet"
              description="A school admin must build this level's period grid before a class timetable can be filled in."
            />
          )}
          {classViews && classViews.length > 1 && (
            <FormField label="Class" htmlFor="my-timetable-class" className="max-w-xs">
              <Select id="my-timetable-class" value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
                {classViews.map((view) => (
                  <option key={view.classId} value={view.classId}>
                    {view.className}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          {selectedClassView && (
            <TimetableGrid view={selectedClassView} subjects={[]} teachers={[]} onSaved={() => {}} />
          )}
        </>
      )}
    </div>
  );
}

function groupByDay(entries: MyTimetableEntryView[]): Map<number, MyTimetableEntryView[]> {
  const map = new Map<number, MyTimetableEntryView[]>();
  for (const entry of entries) {
    const list = map.get(entry.dayOfWeek) ?? [];
    list.push(entry);
    map.set(entry.dayOfWeek, list);
  }
  return map;
}

function TimetableAgendaRow({ entry }: { entry: MyTimetableEntryView }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div>
        <p className="text-sm font-medium text-slate-900">
          {entry.entryKind === "ACTIVITY" ? entry.label : (entry.subjectName ?? "—")}
        </p>
        <p className="text-xs text-slate-500">
          {entry.className} &middot; {entry.periodLabel}
        </p>
      </div>
      <div className="text-xs text-slate-500">
        <span className="whitespace-nowrap">{formatClockTime(entry.startTime)}</span>
        {" – "}
        <span className="whitespace-nowrap">{formatClockTime(entry.endTime)}</span>
      </div>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`cursor-pointer border-b-2 px-3 py-2 text-sm font-medium mobile:min-h-11 ${
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
