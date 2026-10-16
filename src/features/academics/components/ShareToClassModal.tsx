import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { SubjectTargetSelect } from "@/features/academics/components/SubjectTargetSelect";
import { type GroupableSubject, parseTargetKey } from "@/features/academics/subjectTarget";

/** Another class (level) of the branch a copy may be sent to - the backend's `ShareTargetClassView`, in either module. */
export interface ShareTargetClass {
  levelId: string;
  levelName: string;
  classrooms: { classId: string; className: string; alreadyShared: boolean }[];
}

/** The subjects and subject groups of a target class a copy may be filed under. */
export interface ShareTargetSubjects {
  subjects: GroupableSubject[];
  subjectGroups: { subjectGroupId: string; subjectGroupName: string }[];
}

/** A cross-class share request - exactly one of `subjectId`/`subjectGroupId`. */
export interface ShareToClassRequest {
  levelId: string;
  classIds: string[];
  subjectId: string | null;
  subjectGroupId: string | null;
}

/** The classrooms of `target` that don't already hold a copy - pre-ticked when the class is picked. */
function openClassroomIds(target: ShareTargetClass | null, single: boolean): string[] {
  const open = target?.classrooms.filter((classroom) => !classroom.alreadyShared) ?? [];
  if (single) return open.length === 1 ? [open[0].classId] : [];
  return open.map((classroom) => classroom.classId);
}

interface GroupedClassroomListProps {
  targets: ShareTargetClass[];
  /** The class whose classrooms are picked - a share goes to one class at a time. */
  levelId: string;
  selected: ReadonlySet<string>;
  single: boolean;
  /** A new pick: `levelId` changes when a classroom of another class is ticked. */
  onPick: (levelId: string, next: Set<string>) => void;
}

/**
 * Every target class's classrooms in one scrollable list, grouped under the class's name. The
 * picks belong to one class: ticking a classroom of another class starts a fresh selection there.
 */
function GroupedClassroomList({ targets, levelId, selected, single, onPick }: GroupedClassroomListProps) {
  function toggle(target: ShareTargetClass, classId: string) {
    if (single || target.levelId !== levelId) {
      onPick(target.levelId, new Set([classId]));
      return;
    }
    const next = new Set(selected);
    if (next.has(classId)) next.delete(classId);
    else next.add(classId);
    onPick(target.levelId, next);
  }

  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium text-slate-700">{single ? "Classroom" : "Classrooms"}</legend>
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-control border border-slate-200 p-2">
        {targets.map((target) => {
          const active = target.levelId === levelId;
          const open = target.classrooms.filter((classroom) => !classroom.alreadyShared);
          const allSelected = active && open.length > 0 && open.every((classroom) => selected.has(classroom.classId));
          return (
            <div key={target.levelId} role="group" aria-label={target.levelName}>
              <div className="flex items-center justify-between px-1 pb-0.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {target.levelName}
                </span>
                {!single && open.length > 1 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-600 hover:underline"
                    onClick={() =>
                      onPick(target.levelId, new Set(allSelected ? [] : open.map((classroom) => classroom.classId)))
                    }
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                )}
              </div>
              {target.classrooms.map((classroom) => {
                const id = `share-to-class-classroom-${classroom.classId}`;
                const checked = active && selected.has(classroom.classId);
                return (
                  <label
                    key={classroom.classId}
                    className={`flex items-center gap-2 rounded px-1 py-1 text-sm ${
                      classroom.alreadyShared ? "text-slate-400" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {single ? (
                      <input
                        type="radio"
                        id={id}
                        name="share-to-class-classroom-radio"
                        className="h-4 w-4 border-slate-300 text-brand-500"
                        checked={checked}
                        disabled={classroom.alreadyShared}
                        onChange={() => toggle(target, classroom.classId)}
                      />
                    ) : (
                      <Checkbox
                        id={id}
                        checked={classroom.alreadyShared || checked}
                        disabled={classroom.alreadyShared}
                        onChange={() => toggle(target, classroom.classId)}
                      />
                    )}
                    {classroom.className}
                    {classroom.alreadyShared && <span className="text-xs"> · Already shared</span>}
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

interface ShareToClassModalProps<R> {
  /** What is being shared - mount the modal only while sharing, so each opening starts fresh. */
  item: { id: string; title: string };
  /** "resource" or "quiz" - used in the modal's own wording. */
  noun: string;
  loadTargets: (itemId: string) => Promise<ShareTargetClass[]>;
  loadSubjects: (itemId: string, levelId: string) => Promise<ShareTargetSubjects>;
  share: (itemId: string, request: ShareToClassRequest) => Promise<R>;
  /** Only one classroom may be picked (radio buttons) - a Midterm quiz, whose score belongs to one class. */
  singleClassroom?: boolean;
  /** Shown instead of the subject picker when the chosen class offers no subject at all. */
  noSubjectsMessage?: string;
  /** What happens once shared - shown under the form. */
  footnote: ReactNode;
  onClose: () => void;
  onShared: (result: R) => void;
}

/**
 * Sends a copy of a learning resource or quiz to another class (level) of its branch - the
 * cross-class share. Pick classrooms from one list grouped by class (all of one class's at a time),
 * then the subject the copy is filed under there (always picked by hand, since subjects belong to a class).
 * A classroom that already holds a copy is shown but can't be picked again. Classrooms of the
 * item's own class are shared from its editor instead, so they never appear here.
 */
export function ShareToClassModal<R>({
  item,
  noun,
  loadTargets,
  loadSubjects,
  share,
  singleClassroom = false,
  noSubjectsMessage,
  footnote,
  onClose,
  onShared,
}: ShareToClassModalProps<R>) {
  const itemId = item.id;
  const [targets, setTargets] = useState<ShareTargetClass[] | null>(null);
  const [levelId, setLevelId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [subjects, setSubjects] = useState<ShareTargetSubjects | null>(null);
  const [targetKey, setTargetKey] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTargets(itemId)
      .then((loaded) => {
        if (cancelled) return;
        setTargets(loaded);
        const only = loaded.length === 1 ? loaded[0] : null;
        setLevelId(only?.levelId ?? "");
        setSelectedClassIds(new Set(openClassroomIds(only, singleClassroom)));
        setTargetKey("");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Couldn't load the classes to share with.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each opening mounts the modal afresh for one item, so the loader props never change underneath it
  }, [itemId]);

  useEffect(() => {
    if (!levelId) return;
    let cancelled = false;
    loadSubjects(itemId, levelId)
      .then((loaded) => {
        if (!cancelled) setSubjects(loaded);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Couldn't load that class's subjects.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as above; reloads only when the class changes
  }, [itemId, levelId]);

  const level = useMemo(() => targets?.find((target) => target.levelId === levelId) ?? null, [targets, levelId]);
  const available = level?.classrooms.filter((classroom) => !classroom.alreadyShared) ?? [];
  const noSubjects = subjects !== null && subjects.subjects.length === 0 && subjects.subjectGroups.length === 0;

  /** Applies a classroom pick; moving to another class resets its subject and reloads the subjects. */
  function pickClassrooms(nextLevelId: string, next: Set<string>) {
    if (nextLevelId !== levelId) {
      setLevelId(nextLevelId);
      setSubjects(null);
      setTargetKey("");
    }
    setSelectedClassIds(next);
    setSubmitError(null);
  }

  async function handleShare() {
    if (!levelId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await share(itemId, {
        levelId,
        classIds: Array.from(selectedClassIds),
        ...parseTargetKey(targetKey),
      });
      onShared(result);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : `Couldn't share this ${noun}.`);
    } finally {
      setSubmitting(false);
    }
  }

  const canShare = Boolean(levelId) && selectedClassIds.size > 0 && Boolean(targetKey) && !submitting;

  return (
    <Modal open onClose={onClose} title="Share to another class">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Send a copy of <span className="font-medium text-slate-900">{item.title}</span> to another class.
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
            <GroupedClassroomList
              targets={targets}
              levelId={levelId}
              selected={selectedClassIds}
              single={singleClassroom}
              onPick={pickClassrooms}
            />

            {level && available.length > 0 && (
              <FormField label="Subject" htmlFor="share-to-class-subject">
                {subjects === null ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Spinner /> Loading subjects…
                  </div>
                ) : noSubjects && noSubjectsMessage ? (
                  <Alert variant="info">{noSubjectsMessage}</Alert>
                ) : (
                  <SubjectTargetSelect
                    id="share-to-class-subject"
                    value={targetKey}
                    onChange={setTargetKey}
                    subjects={subjects.subjects}
                    subjectGroups={subjects.subjectGroups}
                  />
                )}
              </FormField>
            )}

            {level && available.length > 0 && <p className="text-xs text-slate-500">{footnote}</p>}
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
