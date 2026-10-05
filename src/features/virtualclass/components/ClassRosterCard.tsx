import { ClipboardList, MessageSquare, Plus, UserMinus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type ClassRoster,
  type Learner,
  enrollLearners,
  getClassRoster,
  listLearners,
  unenrollLearner,
} from "@/api/learners";
import { getLearnerAttendance } from "@/api/liveSessions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { can } from "@/auth/permissions";
import { useCreatorPlanStore } from "@/stores/creatorPlanStore";
import { AttendanceHistoryModal } from "./AttendanceModals";

interface ClassRosterCardProps {
  classId: string;
  /** False for an archived or over-limit class - enrolling is refused, removing still works. */
  writable: boolean;
  /** The creator's timezone, which attendance dates are shown in. */
  timezone: string;
}

/**
 * A class's enrolled learners (creators.md Phase C5) with the plan's per-class limit. Learners beyond
 * the limit after a downgrade are flagged, newest first, and can't join live sessions.
 */
export function ClassRosterCard({ classId, writable, timezone }: ClassRosterCardProps) {
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [attendanceOf, setAttendanceOf] = useState<{ learnerId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const canMessage = can.viewClassMessages("CREATOR", useCreatorPlanStore((state) => state.plan?.communication ?? false));

  const load = useCallback(() => {
    getClassRoster(classId)
      .then((loaded) => {
        setRoster(loaded);
        setError(null);
      })
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, "Failed to load this class's learners.")));
  }, [classId]);

  useEffect(load, [load]);

  const full = roster !== null && roster.maxStudentsPerClass !== null && roster.activeCount >= roster.maxStudentsPerClass;

  async function remove(learnerId: string) {
    try {
      await unenrollLearner(classId, learnerId);
      load();
    } catch (actionError) {
      setError(getErrorMessage(actionError, "Failed to remove the learner."));
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Learners</h2>
          {roster && (
            <p className="text-sm text-slate-500">
              {roster.activeCount}
              {roster.maxStudentsPerClass !== null ? ` of ${roster.maxStudentsPerClass}` : ""} enrolled
              {full && " - your plan's limit for one class."}
            </p>
          )}
        </div>
        {writable && (
          <Button variant="secondary" onClick={() => setEnrolling(true)} disabled={roster === null || full}>
            <Plus className="h-4 w-4" /> Enroll learners
          </Button>
        )}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {roster === null && !error ? (
        <Spinner />
      ) : roster && roster.learners.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No learners yet. Enroll learners from your <Link className="text-brand-500" to="/creator/learners">roster</Link>.
        </p>
      ) : (
        roster && (
          <ul className="divide-y divide-slate-100">
            {roster.learners.map((entry) => (
              <li key={entry.learnerId} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-sm text-slate-900">
                  {entry.firstName} {entry.lastName}
                  {entry.minor && <span className="ml-2 text-xs text-slate-500">Child</span>}
                </span>
                {entry.overLimit && <Badge variant="warning">Over plan limit</Badge>}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Attendance of ${entry.firstName} ${entry.lastName}`}
                  onClick={() =>
                    setAttendanceOf({ learnerId: entry.learnerId, name: `${entry.firstName} ${entry.lastName}` })
                  }
                >
                  <ClipboardList className="h-4 w-4" />
                </Button>
                {canMessage && (
                  <Link
                    to={`/creator/messages?classId=${classId}&learnerId=${entry.learnerId}`}
                    aria-label={`Message ${entry.firstName} ${entry.lastName}`}
                    className="inline-flex items-center rounded-control px-3 py-1.5 text-slate-600 hover:bg-slate-100 mobile:min-h-11"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${entry.firstName} ${entry.lastName} from this class`}
                  onClick={() => remove(entry.learnerId)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )
      )}
      {attendanceOf && (
        <AttendanceHistoryModal
          title={`Attendance · ${attendanceOf.name}`}
          timezone={timezone}
          load={() => getLearnerAttendance(classId, attendanceOf.learnerId)}
          onClose={() => setAttendanceOf(null)}
        />
      )}
      {enrolling && roster && (
        <EnrollModal
          enrolledIds={roster.learners.map((entry) => entry.learnerId)}
          onClose={() => setEnrolling(false)}
          onSubmit={async (learnerIds) => {
            setRoster(await enrollLearners(classId, learnerIds));
            setEnrolling(false);
          }}
        />
      )}
    </Card>
  );
}

function EnrollModal({
  enrolledIds,
  onSubmit,
  onClose,
}: {
  enrolledIds: string[];
  onSubmit: (learnerIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [roster, setRoster] = useState<Learner[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listLearners()
      .then((loaded) => {
        if (!cancelled) {
          setRoster(loaded.learners);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load your learners."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const learners = roster?.filter((learner) => !enrolledIds.includes(learner.id)) ?? null;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(selected);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Failed to enroll the learners."));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Enroll learners">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {learners === null && !error && <Spinner />}
        {learners && learners.length === 0 && (
          <p className="text-sm text-slate-600">
            Everyone on your roster is already in this class. Add new learners on the{" "}
            <Link className="text-brand-500" to="/creator/learners">
              Learners
            </Link>{" "}
            page.
          </p>
        )}
        {learners && learners.length > 0 && (
          <div className="space-y-2">
            {learners.map((learner) => (
              <label key={learner.id} className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  checked={selected.includes(learner.id)}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(learner.id)
                        ? current.filter((id) => id !== learner.id)
                        : [...current, learner.id],
                    )
                  }
                />
                {learner.firstName} {learner.lastName}
              </label>
            ))}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={selected.length === 0}>
            Enroll
          </Button>
        </div>
      </div>
    </Modal>
  );
}
