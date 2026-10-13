import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import {
  getShareTargetSubjects,
  getShareTargets,
  type ShareResultView,
  type ShareTargetClassView,
  type ShareTargetSubjectsView,
  shareLearningResource,
} from "@/api/learning";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { SubjectTargetSelect } from "@/features/academics/components/SubjectTargetSelect";
import { parseTargetKey } from "@/features/academics/subjectTarget";

/** The classrooms of `target` that don't already hold a copy - pre-ticked when the class is picked. */
function openClassroomIds(target: ShareTargetClassView | null): string[] {
  return target?.classrooms.filter((classroom) => !classroom.alreadyShared).map((classroom) => classroom.classId) ?? [];
}

interface ShareResourceModalProps {
  /** The resource to share - mount the modal only while sharing, so each opening starts fresh. */
  resource: { id: string; title: string };
  onClose: () => void;
  onShared: (result: ShareResultView) => void;
}

/**
 * Sends a published copy of a learning resource to another class (level) of its branch - the
 * cross-class share. Pick the class, then its classrooms (skipped when it has only one), then the
 * subject the copy is filed under there (always picked by hand, since subjects belong to a class).
 * A classroom that already holds a copy is shown but can't be picked again. Classrooms of the
 * resource's own class are shared from the editor instead, so they never appear here.
 */
export function ShareResourceModal({ resource, onClose, onShared }: ShareResourceModalProps) {
  const resourceId = resource.id;
  const [targets, setTargets] = useState<ShareTargetClassView[] | null>(null);
  const [levelId, setLevelId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [subjects, setSubjects] = useState<ShareTargetSubjectsView | null>(null);
  const [targetKey, setTargetKey] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getShareTargets(resourceId)
      .then((loaded) => {
        if (cancelled) return;
        setTargets(loaded);
        const only = loaded.length === 1 ? loaded[0] : null;
        setLevelId(only?.levelId ?? "");
        setSelectedClassIds(new Set(openClassroomIds(only)));
        setTargetKey("");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Couldn't load the classes to share with.");
      });
    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  useEffect(() => {
    if (!levelId) return;
    let cancelled = false;
    getShareTargetSubjects(resourceId, levelId)
      .then((loaded) => {
        if (!cancelled) setSubjects(loaded);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Couldn't load that class's subjects.");
      });
    return () => {
      cancelled = true;
    };
  }, [resourceId, levelId]);

  const level = useMemo(() => targets?.find((target) => target.levelId === levelId) ?? null, [targets, levelId]);
  const available = level?.classrooms.filter((classroom) => !classroom.alreadyShared) ?? [];

  /** Picks a class and pre-ticks every classroom of it that doesn't already hold a copy. */
  function selectLevel(target: ShareTargetClassView | null) {
    setLevelId(target?.levelId ?? "");
    setSelectedClassIds(new Set(openClassroomIds(target)));
    setSubjects(null);
    setTargetKey("");
    setSubmitError(null);
  }

  function toggleClassroom(classId: string) {
    setSelectedClassIds((current) => {
      const next = new Set(current);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  const allSelected = available.length > 0 && available.every((classroom) => selectedClassIds.has(classroom.classId));

  function toggleAll() {
    setSelectedClassIds(allSelected ? new Set() : new Set(available.map((classroom) => classroom.classId)));
  }

  async function handleShare() {
    if (!levelId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await shareLearningResource(resourceId, {
        levelId,
        classIds: Array.from(selectedClassIds),
        ...parseTargetKey(targetKey),
      });
      onShared(result);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Couldn't share this resource.");
    } finally {
      setSubmitting(false);
    }
  }

  const canShare = Boolean(levelId) && selectedClassIds.size > 0 && Boolean(targetKey) && !submitting;

  return (
    <Modal open onClose={onClose} title="Share to another class">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Send a copy of <span className="font-medium text-slate-900">{resource.title}</span> to another class.
        </p>
        {loadError && <Alert variant="error">{loadError}</Alert>}
        {submitError && <Alert variant="error">{submitError}</Alert>}

        {targets === null && !loadError && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading classes…
          </div>
        )}

        {targets !== null && targets.length === 0 && (
          <Alert variant="info">There are no other classes with classrooms at this branch yet.</Alert>
        )}

        {targets !== null && targets.length > 0 && (
          <>
            <FormField label="Class" htmlFor="share-resource-class">
              <Select
                id="share-resource-class"
                value={levelId}
                onChange={(event) =>
                  selectLevel(targets.find((target) => target.levelId === event.target.value) ?? null)
                }
              >
                <option value="">Select a class…</option>
                {targets.map((target) => (
                  <option key={target.levelId} value={target.levelId}>
                    {target.levelName}
                  </option>
                ))}
              </Select>
            </FormField>

            {level && level.classrooms.length === 1 && (
              <p className="text-sm text-slate-600" data-testid="single-classroom">
                {level.classrooms[0].alreadyShared ? (
                  <>
                    <span className="font-medium text-slate-900">{level.classrooms[0].className}</span> already has
                    a copy of this resource.
                  </>
                ) : (
                  <>
                    Will be shared with{" "}
                    <span className="font-medium text-slate-900">{level.classrooms[0].className}</span>.
                  </>
                )}
              </p>
            )}

            {level && level.classrooms.length > 1 && (
              <fieldset className="space-y-1">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-medium text-slate-700">Classrooms</legend>
                  {available.length > 1 && (
                    <button
                      type="button"
                      className="text-sm font-medium text-brand-600 hover:underline"
                      onClick={toggleAll}
                    >
                      {allSelected ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
                <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-control border border-slate-200 p-2">
                  {level.classrooms.map((classroom) => (
                    <label
                      key={classroom.classId}
                      className={`flex items-center gap-2 rounded px-1 py-1 text-sm ${
                        classroom.alreadyShared ? "text-slate-400" : "hover:bg-slate-50"
                      }`}
                    >
                      <Checkbox
                        checked={classroom.alreadyShared || selectedClassIds.has(classroom.classId)}
                        disabled={classroom.alreadyShared}
                        onChange={() => toggleClassroom(classroom.classId)}
                      />
                      {classroom.className}
                      {classroom.alreadyShared && <span className="text-xs"> · Already shared</span>}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {level && available.length > 0 && (
              <FormField label="Subject" htmlFor="share-resource-subject">
                {subjects === null ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Spinner /> Loading subjects…
                  </div>
                ) : (
                  <SubjectTargetSelect
                    id="share-resource-subject"
                    value={targetKey}
                    onChange={setTargetKey}
                    subjects={subjects.subjects}
                    subjectGroups={subjects.subjectGroups}
                  />
                )}
              </FormField>
            )}

            {level && available.length > 0 && (
              <p className="text-xs text-slate-500">
                Students in the selected classrooms will see the copy straight away. Their teachers manage it from
                then on, and your later edits won't carry over.
              </p>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleShare} disabled={!canShare}>
            {submitting ? "Sharing…" : "Share"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
