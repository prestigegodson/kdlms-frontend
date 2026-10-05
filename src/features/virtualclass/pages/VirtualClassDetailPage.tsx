import { Archive, ArchiveRestore, BookOpen, ClipboardCheck, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import { getMyCreatorProfile } from "@/api/creators";
import {
  type ClashWarning,
  type Occurrence,
  type VirtualClass,
  addOneOffSession,
  archiveVirtualClass,
  deleteVirtualClass,
  getVirtualClass,
  listOccurrences,
  restoreVirtualClass,
  saveSchedule,
  updateVirtualClass,
} from "@/api/virtualClasses";
import { can } from "@/auth/permissions";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ClassFormModal } from "../components/ClassFormModal";
import { ClassRosterCard } from "../components/ClassRosterCard";
import { ScheduleEditor } from "../components/ScheduleEditor";
import { SessionList } from "../components/SessionList";
import { SessionTimeModal } from "../components/SessionTimeModal";
import { useCreatorPlanStore } from "@/stores/creatorPlanStore";
import {
  type SlotDraft,
  addDays,
  dateInZone,
  hhmm,
  scheduleProblems,
  shortDate,
} from "../scheduleUtils";

const UPCOMING_DAYS = 28;

function toDrafts(virtualClass: VirtualClass): SlotDraft[] {
  return virtualClass.slots.map((slot) => ({
    key: slot.id,
    id: slot.id,
    dayOfWeek: slot.dayOfWeek,
    startTime: hhmm(slot.startTime),
    durationMinutes: slot.durationMinutes,
  }));
}

/** One class: its details, weekly schedule editor and the next four weeks of sessions (creators.md Phase C4). */
export function VirtualClassDetailPage() {
  const { classId = "" } = useParams();
  const navigate = useNavigate();
  // The plan is fetched by CreatorLayout; the Lesson notes shortcut shows once it has loaded.
  const lessonNotesIncluded = useCreatorPlanStore((state) => state.plan?.lessonNotes ?? false);
  const quizzesIncluded = useCreatorPlanStore((state) => state.plan?.takeHomeQuiz ?? false);
  const resourcesIncluded = useCreatorPlanStore((state) => state.plan?.onDemandLearning ?? false);
  const [virtualClass, setVirtualClass] = useState<VirtualClass | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SlotDraft[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ClashWarning[]>([]);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [sessions, setSessions] = useState<Occurrence[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingSession, setAddingSession] = useState(false);
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);

  const loadSessions = useCallback(
    (zone: string) => {
      const from = dateInZone(new Date(), zone);
      listOccurrences(from, addDays(from, UPCOMING_DAYS - 1), classId)
        .then((calendar) => setSessions(calendar.occurrences))
        .catch(() => setSessions([]));
    },
    [classId],
  );

  const applyClass = useCallback((loaded: VirtualClass) => {
    setVirtualClass(loaded);
    setDrafts(toDrafts(loaded));
  }, []);

  useEffect(() => {
    Promise.all([getVirtualClass(classId), getMyCreatorProfile()])
      .then(([loaded, profile]) => {
        applyClass(loaded);
        setTimezone(profile.timezone);
        loadSessions(profile.timezone);
      })
      .catch((error: unknown) =>
        setLoadError(getErrorMessage(error, "Failed to load this class.")),
      );
  }, [classId, applyClass, loadSessions]);

  const problems = useMemo(() => scheduleProblems(drafts), [drafts]);
  const dirty = useMemo(
    () =>
      virtualClass !== null && JSON.stringify(drafts) !== JSON.stringify(toDrafts(virtualClass)),
    [drafts, virtualClass],
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Class" backTo="/creator/classes" />
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }
  if (!virtualClass || !timezone) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading class…
      </div>
    );
  }

  const archived = virtualClass.status === "ARCHIVED";
  const writable = !archived && !virtualClass.overLimit;
  const today = dateInZone(new Date(), timezone);

  async function runAction(action: () => Promise<VirtualClass>, fallback: string) {
    setActionError(null);
    try {
      const updated = await action();
      applyClass(updated);
      loadSessions(timezone ?? "UTC");
    } catch (error) {
      setActionError(getErrorMessage(error, fallback));
    }
  }

  async function handleSaveSchedule() {
    if (!virtualClass) return;
    setSavingSchedule(true);
    setScheduleError(null);
    setScheduleSaved(false);
    try {
      const outcome = await saveSchedule(
        virtualClass.id,
        drafts.map(({ id, dayOfWeek, startTime, durationMinutes }) => ({
          id,
          dayOfWeek,
          startTime,
          durationMinutes,
        })),
      );
      applyClass(outcome.virtualClass);
      setWarnings(outcome.warnings);
      setScheduleSaved(true);
      loadSessions(timezone ?? "UTC");
    } catch (error) {
      setScheduleError(getErrorMessage(error, "Failed to save the schedule."));
    } finally {
      setSavingSchedule(false);
    }
  }

  const dates = `${shortDate(virtualClass.startDate)} – ${virtualClass.endDate ? shortDate(virtualClass.endDate) : "ongoing"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={virtualClass.name}
        description={[virtualClass.subjectLabel, dates].filter(Boolean).join(" · ")}
        backTo="/creator/classes"
        actions={
          <ActionMenu
            ariaLabel="Actions for this class"
            items={[
              ...(writable
                ? [{ label: "Edit details", icon: Pencil, onSelect: () => setEditing(true) }]
                : []),
              ...(can.viewClassLessonNotes("CREATOR", lessonNotesIncluded)
                ? [
                    {
                      label: "Lesson notes",
                      icon: NotebookPen,
                      onSelect: () => navigate(`/creator/lesson-notes?classId=${virtualClass.id}`),
                    },
                  ]
                : []),
              ...(can.viewClassQuizzes("CREATOR", quizzesIncluded)
                ? [
                    {
                      label: "Quizzes",
                      icon: ClipboardCheck,
                      onSelect: () => navigate(`/creator/quizzes?classId=${virtualClass.id}`),
                    },
                  ]
                : []),
              ...(can.viewClassResources("CREATOR", resourcesIncluded)
                ? [
                    {
                      label: "Resources",
                      icon: BookOpen,
                      onSelect: () => navigate(`/creator/resources?classId=${virtualClass.id}`),
                    },
                  ]
                : []),
              archived
                ? {
                    label: "Restore",
                    icon: ArchiveRestore,
                    onSelect: () =>
                      void runAction(
                        () => restoreVirtualClass(virtualClass.id),
                        "Failed to restore.",
                      ),
                  }
                : { label: "Archive", icon: Archive, onSelect: () => setConfirming("archive") },
              {
                label: "Delete",
                icon: Trash2,
                variant: "danger" as const,
                separated: true,
                onSelect: () => setConfirming("delete"),
              },
            ]}
          />
        }
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}
      {archived && (
        <Alert variant="info" title="This class is archived">
          It has no upcoming sessions. Restore it to schedule sessions again.
        </Alert>
      )}
      {virtualClass.overLimit && (
        <Alert variant="warning" title="Over your plan's class limit">
          This class is read-only and can't hold sessions. Archive another class or upgrade your
          plan to use it again.
        </Alert>
      )}
      {virtualClass.description && (
        <p className="text-sm whitespace-pre-line text-slate-700">{virtualClass.description}</p>
      )}

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Weekly schedule</h2>
            <p className="text-sm text-slate-500">Times are in {timezone}.</p>
          </div>
          {writable && (
            <Button
              onClick={() => void handleSaveSchedule()}
              loading={savingSchedule}
              disabled={!dirty || problems.length > 0}
            >
              Save schedule
            </Button>
          )}
        </div>
        {problems.length > 0 && (
          <Alert variant="error" className="mb-2">
            <ul className="list-inside list-disc">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Alert>
        )}
        {scheduleError && (
          <Alert variant="error" className="mb-2">
            {scheduleError}
          </Alert>
        )}
        {scheduleSaved && !dirty && warnings.length === 0 && (
          <Alert variant="success" className="mb-2">
            Schedule saved. Upcoming sessions have been updated.
          </Alert>
        )}
        {warnings.length > 0 && !dirty && (
          <Alert
            variant="warning"
            title="Schedule saved, but it overlaps another of your classes"
            className="mb-2"
          >
            <ul className="list-inside list-disc">
              {warnings.map((warning) => (
                <li key={`${warning.otherClassId}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
          </Alert>
        )}
        <ScheduleEditor slots={drafts} onChange={setDrafts} disabled={!writable} />
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Upcoming sessions</h2>
            <p className="text-sm text-slate-500">
              The next four weeks. Rescheduled or cancelled sessions keep their changes when you
              edit the schedule.
            </p>
          </div>
          {writable && (
            <Button variant="secondary" onClick={() => setAddingSession(true)}>
              <Plus className="h-4 w-4" /> Add one-off session
            </Button>
          )}
        </div>
        {sessions === null ? (
          <Spinner />
        ) : (
          <SessionList
            occurrences={sessions}
            timezone={timezone}
            emptyMessage={
              writable
                ? "No upcoming sessions - add a weekly schedule above."
                : "No upcoming sessions."
            }
            onChanged={() => loadSessions(timezone)}
          />
        )}
      </Card>

      <ClassRosterCard classId={virtualClass.id} writable={writable} timezone={timezone} />

      {editing && (
        <ClassFormModal
          existing={virtualClass}
          defaultStartDate={today}
          onClose={() => setEditing(false)}
          onSubmit={async (input) => {
            const updated = await updateVirtualClass(virtualClass.id, input);
            applyClass(updated);
            setEditing(false);
            loadSessions(timezone);
          }}
        />
      )}
      {addingSession && (
        <SessionTimeModal
          title="Add a one-off session"
          submitLabel="Add session"
          timezone={timezone}
          minDate={today}
          initial={{ date: addDays(today, 1), startTime: "09:00", durationMinutes: 60 }}
          onClose={() => setAddingSession(false)}
          onSubmit={async (input) => {
            await addOneOffSession(virtualClass.id, input);
            setAddingSession(false);
            loadSessions(timezone);
          }}
        />
      )}
      {confirming === "archive" && (
        <ConfirmDialog
          title="Archive this class?"
          message="Its upcoming weekly sessions are removed and it stops counting towards your plan's class limit. You can restore it later."
          confirmLabel="Archive"
          onClose={() => setConfirming(null)}
          onConfirm={async () => {
            const updated = await archiveVirtualClass(virtualClass.id);
            applyClass(updated);
            setConfirming(null);
            loadSessions(timezone);
          }}
        />
      )}
      {confirming === "delete" && (
        <ConfirmDialog
          title="Delete this class?"
          message="The class, its schedule and all its sessions are permanently deleted. A class that has already held sessions can only be archived."
          confirmLabel="Delete class"
          variant="danger"
          confirmationText={virtualClass.name}
          onClose={() => setConfirming(null)}
          onConfirm={async () => {
            await deleteVirtualClass(virtualClass.id);
            navigate("/creator/classes");
          }}
        />
      )}
    </div>
  );
}
