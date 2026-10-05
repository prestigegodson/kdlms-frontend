import { NotebookPen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError, getErrorMessage } from "@/api/client";
import {
  type ClassLessonNoteListView,
  type ClassLessonNoteView,
  type ClassNotesReader,
  getPublishedClassLessonNote,
  listPublishedClassLessonNotes,
} from "@/api/lessonNotes";
import { listMyOnlineClasses, listWardOnlineClasses } from "@/api/onlineClasses";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { LessonNoteReadView } from "@/features/lessonNotes/components/LessonNoteReadView";
import { MathText } from "@/features/lessonNotes/components/MathText";
import { ClassNoteImage } from "@/features/lessonNotes/reader/ClassNoteImage";
import { formatLongDate } from "@/utils/date";

export type ClassNotesAudience = "LEARNER" | "GUARDIAN";

/** One class the viewer can read - for a guardian, one per (followed learner, class). */
interface FollowedClassOption {
  key: string;
  classId: string;
  learnerId?: string;
  label: string;
}

const optionKey = (classId: string, learnerId?: string | null) => `${classId}:${learnerId ?? ""}`;

/**
 * A learner's or a guardian's read of their tutors' published class lesson notes (creators Phase
 * C12). Pick a class (a guardian picks a child's class), see its published notes newest session
 * first, and read one. The class, learner and note live in the URL (`?classId=&learnerId=&noteId=`),
 * so an online-class card's "Lesson notes" link lands straight on the class. Images load through
 * the note's own narrow endpoint - `/api/v1/files` never admits a learner or guardian.
 */
export function ClassLessonNotesReaderPage({ audience }: { audience: ClassNotesAudience }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId");
  const learnerId = searchParams.get("learnerId") ?? undefined;
  const noteId = searchParams.get("noteId");

  const [options, setOptions] = useState<FollowedClassOption[] | null>(null);
  const [loadedList, setList] = useState<ClassLessonNoteListView | null>(null);
  const [loadedNote, setNote] = useState<ClassLessonNoteView | null>(null);
  // Keyed by the option it was answered for, so switching class never shows a stale refusal.
  const [refusal, setRefusal] = useState<{ key: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reader: ClassNotesReader | null = useMemo(
    () => (classId ? { classId, learnerId: audience === "GUARDIAN" ? learnerId : undefined } : null),
    [audience, classId, learnerId],
  );
  const list = loadedList?.classId === classId ? loadedList : null;
  const currentKey = optionKey(classId ?? "", learnerId);
  const notIncluded = refusal?.key === currentKey ? refusal.message : null;
  const note = loadedNote?.id === noteId && loadedNote?.classId === classId ? loadedNote : null;

  useEffect(() => {
    const load: Promise<FollowedClassOption[]> =
      audience === "GUARDIAN"
        ? listWardOnlineClasses().then((learners) =>
            learners.flatMap((learner) =>
              learner.classes.map((virtualClass) => ({
                key: optionKey(virtualClass.id, learner.learnerId),
                classId: virtualClass.id,
                learnerId: learner.learnerId,
                label: `${learner.firstName} - ${virtualClass.name}`,
              })),
            ),
          )
        : listMyOnlineClasses().then((classes) =>
            classes.map((virtualClass) => ({
              key: optionKey(virtualClass.id),
              classId: virtualClass.id,
              label: virtualClass.creatorName ? `${virtualClass.name} · ${virtualClass.creatorName}` : virtualClass.name,
            })),
          );
    load.then(setOptions).catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your classes.")));
  }, [audience]);

  // Land on the first class when none is chosen yet.
  useEffect(() => {
    if (!classId && options && options.length > 0) {
      const first = options[0];
      setSearchParams(first.learnerId ? { classId: first.classId, learnerId: first.learnerId } : { classId: first.classId }, {
        replace: true,
      });
    }
  }, [classId, options, setSearchParams]);

  useEffect(() => {
    if (!reader) {
      return;
    }
    let cancelled = false;
    const key = optionKey(reader.classId, reader.learnerId);
    listPublishedClassLessonNotes(reader)
      .then((loaded) => {
        if (!cancelled) {
          setList(loaded);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setRefusal({ key, message: err.message });
        } else {
          setError(getErrorMessage(err, "We couldn't load this class's lesson notes."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reader]);

  useEffect(() => {
    if (!reader || !noteId) {
      return;
    }
    let cancelled = false;
    getPublishedClassLessonNote(reader, noteId)
      .then((loaded) => {
        if (!cancelled) setNote(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "We couldn't load this lesson note."));
      });
    return () => {
      cancelled = true;
    };
  }, [reader, noteId]);

  function select(params: { classId: string; learnerId?: string; noteId?: string }) {
    const next: Record<string, string> = { classId: params.classId };
    if (params.learnerId) next.learnerId = params.learnerId;
    if (params.noteId) next.noteId = params.noteId;
    setSearchParams(next);
  }

  const selectedOption = options?.find((option) => option.key === currentKey);

  return (
    <div className="space-y-6">
      <PageHeader
        title={audience === "GUARDIAN" ? "Class lesson notes" : "Lesson notes"}
        description={
          audience === "GUARDIAN"
            ? "Notes your children's online class tutors have shared."
            : "Notes your tutors have shared for each class."
        }
      />

      {error ? (
        <ErrorState message={error} />
      ) : options === null ? (
        <Skeleton className="h-40" />
      ) : options.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No online classes"
          description="Lesson notes from your tutors' classes show up here."
        />
      ) : (
        <>
          <FormField label="Class" htmlFor="class-notes-class">
            <Select
              id="class-notes-class"
              value={selectedOption?.key ?? ""}
              onChange={(event) => {
                const option = options.find((candidate) => candidate.key === event.target.value);
                if (option) select({ classId: option.classId, learnerId: option.learnerId });
              }}
            >
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          {notIncluded ? (
            <EmptyState icon={NotebookPen} title="Lesson notes aren't available" description={notIncluded} />
          ) : list === null ? (
            <Skeleton className="h-40" />
          ) : list.notes.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No lesson notes yet"
              description="Your tutor hasn't shared any notes for this class yet."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <ul
                className={`divide-y divide-slate-100 rounded-card border border-slate-200 bg-white ${noteId ? "max-lg:hidden" : ""}`}
              >
                {list.notes.map((summary) => (
                  <li key={summary.id}>
                    <button
                      type="button"
                      onClick={() => select({ classId: list.classId, learnerId, noteId: summary.id })}
                      aria-current={summary.id === noteId ? "true" : undefined}
                      className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-slate-50 ${
                        summary.id === noteId ? "bg-brand-50" : ""
                      }`}
                    >
                      <span className="text-sm font-medium text-slate-900">
                        <MathText text={summary.topic} />
                      </span>
                      <span className="text-xs text-slate-500">
                        {summary.sessionDate ? formatLongDate(summary.sessionDate) : "For the whole class"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div>
                {noteId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mb-3 lg:hidden"
                    onClick={() => select({ classId: list.classId, learnerId })}
                  >
                    Back to {list.className}
                  </Button>
                )}
                {note && reader ? (
                  <article className="space-y-4 rounded-card border border-slate-200 bg-white p-4">
                    <header>
                      <h2 className="text-lg font-semibold text-slate-900">
                        <MathText text={note.topic} />
                      </h2>
                      <p className="text-sm text-slate-500">
                        {note.sessionDate ? formatLongDate(note.sessionDate) : "For the whole class"}
                      </p>
                    </header>
                    <LessonNoteReadView
                      content={note.content}
                      renderImage={(fileId, alt) => (
                        <ClassNoteImage reader={reader} noteId={note.id} fileId={fileId} alt={alt} />
                      )}
                    />
                  </article>
                ) : noteId ? (
                  <Skeleton className="h-40" />
                ) : (
                  <p className="hidden rounded-card border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 lg:block">
                    Choose a note to read it.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
