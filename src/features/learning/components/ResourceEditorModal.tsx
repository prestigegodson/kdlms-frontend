import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ClassLearningResourceView } from "@/api/classLearningResources";
import { ApiError } from "@/api/client";
import { getFileMediaUrl, uploadFile, uploadLimitFor, uploadLimitLabel, uploadMediaFile } from "@/api/files";
import {
  type AuthorableSubjectGroupView,
  type AuthorableSubjectView,
  createLearningResource,
  type EligibleStudentView,
  getEligibleStudents,
  getShareableClasses,
  type InteractiveVideoDocument,
  type LearningGalleryFileView,
  type LearningResourceType,
  type LearningResourceView,
  type SharedClassView,
  updateLearningResource,
  type UpdateLearningResourceRequest,
} from "@/api/learning";
import { type Audience, AudienceField } from "@/components/AudienceField";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { RichTextField } from "@/components/richText/RichTextField";
import { type GalleryLoader, GalleryPickerModal } from "@/features/learning/components/GalleryPickerModal";
import { ClassroomArmsField } from "@/features/academics/components/ClassroomArmsField";
import { SubjectTargetSelect } from "@/features/academics/components/SubjectTargetSelect";
import { parseTargetKey, targetKeyOf } from "@/features/academics/subjectTarget";
import { emptyDocument } from "@/features/learning/interactiveVideo/defaults";
import { InteractiveVideoEditor } from "@/features/learning/interactiveVideo/editor/InteractiveVideoEditor";
import { outOfRangeIds } from "@/features/learning/interactiveVideo/engine";
import { useMediaStreamUrl } from "@/hooks/useMediaStreamUrl";
import { formatDuration } from "@/utils/duration";
import { localDateToEndInstant, splitInstant, toInstant } from "@/utils/date";

/** Mirrors backend `learning.domain.LearningRichText.MAX_IMAGES_PER_RESOURCE`. */
const MAX_IMAGES_PER_RESOURCE = 30;

/** The content type each file-backed resource type's upload must declare - mirrors backend `LearningResourceType.expectedContentType`. */
const FILE_CONTENT_TYPE: Record<string, string> = {
  PDF: "application/pdf",
  AUDIO: "audio/mpeg",
  VIDEO: "video/mp4",
  INTERACTIVE_VIDEO: "video/mp4",
};

/**
 * The bare 11-character id of a YouTube link, client-side - only so the interactive video editor
 * can preview it before saving. The backend's own `YouTubeVideoId#parse` stays the authority.
 */
function youTubeIdOf(url: string): string | null {
  const match = url
    .trim()
    .match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

const renderStaffImage = (fileId: string, alt: string) => <AuthenticatedRichImage fileId={fileId} alt={alt} />;

const FILE_BACKED_TYPES: LearningResourceType[] = ["PDF", "AUDIO", "VIDEO"];

/** A blank "Available from" time means local midnight. */
function availableFromInstant(dateIso: string, clockTime: string): string | null {
  return dateIso ? toInstant(dateIso, clockTime || "00:00") : null;
}

/** A blank "Available until" time means the end of that local day (23:59:59.999), the window's original date-only meaning. */
function availableUntilInstant(dateIso: string, clockTime: string): string | null {
  if (!dateIso) {
    return null;
  }
  return clockTime ? toInstant(dateIso, clockTime) : localDateToEndInstant(dateIso);
}

/**
 * Splits a stored `availableUntil` back into its date and time - leaving the time blank when the
 * instant is exactly the end of its local day, so a date-only window (every resource saved before
 * times existed) reads as "end of day" and re-saves unchanged rather than drifting to 23:59:00.
 */
function splitAvailableUntil(instant: string | null | undefined): { dateIso: string; clockTime: string } {
  const split = splitInstant(instant);
  return split.dateIso && availableUntilInstant(split.dateIso, "") === new Date(instant as string).toISOString()
    ? { dateIso: split.dateIso, clockTime: "" }
    : split;
}

/** How long to wait for a picked media file's `loadedmetadata` event before giving up on probing its duration - a slow decode (or a test runner with no real media pipeline) must never block submit. */
const DURATION_PROBE_TIMEOUT_MS = 4000;

/**
 * Probes a picked mp3/mp4's duration client-side via a detached, never-attached media element -
 * so the create form can send `durationSeconds` without asking the author to type it in. Resolves
 * to `null` (never rejects) on any failure: a corrupt file, an unsupported codec, or the probe
 * simply timing out - the caller treats a `null` duration as "unknown", not an error.
 */
function probeMediaDuration(file: File, kind: "audio" | "video"): Promise<number | null> {
  return new Promise((resolve) => {
    const element = document.createElement(kind);
    element.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);

    let settled = false;
    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };

    const timeoutId = window.setTimeout(() => finish(null), DURATION_PROBE_TIMEOUT_MS);
    element.addEventListener("loadedmetadata", () => {
      const duration = element.duration;
      finish(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null);
    });
    element.addEventListener("error", () => finish(null));
    element.src = objectUrl;
  });
}

/** An existing resource the form edits - a school resource, or a creator's class resource (creators Phase C14). */
export type EditableLearningResource = LearningResourceView | ClassLearningResourceView;

/** The payload {@link ResourceEditorModalProps.save} receives - `resourceType` is the one picked on create, or the resource's own on edit. */
export type ResourceEditorPayload = UpdateLearningResourceRequest & { resourceType: LearningResourceType };

interface ResourceEditorModalProps {
  classId: string;
  /** The initial target on create - a subject, or (Phase 35M) a whole subject group; at most one. */
  subjectId?: string;
  subjectGroupId?: string;
  termId?: string;
  subjects?: AuthorableSubjectView[];
  /** The groups the caller may author for (Phase 35M) - offered beside `subjects` in the target picker. */
  subjectGroups?: AuthorableSubjectGroupView[];
  /** Present -> edit an existing resource. Absent -> create a new one, in the target above. */
  resource?: EditableLearningResource;
  /** Whether the caller may author an `AUDIO`/`VIDEO` resource - `can.authorLearningMedia` (Phase 35F), evaluated by the parent since it needs the `learningMedia` feature flag. */
  canAuthorMedia: boolean;
  /** Whether to offer the `INTERACTIVE_VIDEO` type (V161) - `can.authorInteractiveVideo`, evaluated by the parent since it needs the `interactiveVideo` feature flag. An uploaded-mp4 source additionally needs `canAuthorMedia`. */
  canAuthorInteractiveVideo?: boolean;
  /**
   * Overrides where the form saves (creators Phase C14: a creator's class resource) - when absent,
   * it creates/updates a school resource in `classId`/`subjectId`/`termId`.
   */
  save?: (payload: ResourceEditorPayload) => Promise<unknown>;
  /** Overrides where "Choose from gallery" lists files from - passed straight to `GalleryPickerModal`. */
  loadGallery?: GalleryLoader;
  /** Who the availability window hides the resource from, in its hint - "Students" unless overridden. */
  audienceLabel?: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Create-and-edit resource form (Phase 35E; `AUDIO`/`VIDEO` added Phase 35F). `resourceType` is
 * pickable only on create - it's immutable once a resource exists (switching types is a
 * delete-and-recreate), so the picker disappears when editing and the existing type is just
 * implied. Exactly one payload field is shown per type: `RichTextField` for `RICH_TEXT`, a file
 * field for `PDF`/`AUDIO`/`VIDEO`, a URL field for `YOUTUBE` (the raw URL, never a bare id - the
 * backend parses and validates it). The file field's "Choose from gallery" button (Phase 35K)
 * opens `GalleryPickerModal` on top of this one, as a sibling `<Modal>` rather than nested inside
 * it - see that component's own docstring for why nesting would break Escape. Uploading a fresh
 * file (its `accept`/size cap driven by `FILE_CONTENT_TYPE`) and picking a gallery file both
 * converge on the same `fileId`/`fileName`/`durationSeconds` state, so submit doesn't care which
 * one populated it.
 */
export function ResourceEditorModal({
  classId,
  subjectId = "",
  subjectGroupId = "",
  termId = "",
  subjects = [],
  subjectGroups = [],
  resource,
  canAuthorMedia,
  canAuthorInteractiveVideo = false,
  save,
  loadGallery,
  audienceLabel = "Pupils",
  onClose,
  onSaved,
}: ResourceEditorModalProps) {
  const isEdit = resource != null;
  // A target key (`academics/subjectTarget.ts`): a subject's bare id, or `group:<id>` for a subject group.
  const [targetKey, setTargetKey] = useState(
    resource && "subjectId" in resource ? targetKeyOf(resource) : targetKeyOf({ subjectId, subjectGroupId }),
  );
  const target = parseTargetKey(targetKey);
  const [resourceType, setResourceType] = useState<LearningResourceType>(resource?.resourceType ?? "RICH_TEXT");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [bodyHtml, setBodyHtml] = useState(resource?.bodyHtml ?? "");
  const [fileId, setFileId] = useState<string | null>(resource?.fileId ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(resource?.durationSeconds ?? null);
  // An interactive video's link is prefilled from its stored id - its source can't be left blank
  // the way a plain YouTube resource's "keep the current video" field is.
  const [youtubeUrl, setYoutubeUrl] = useState(
    resource?.resourceType === "INTERACTIVE_VIDEO" && resource.youtubeVideoId
      ? `https://www.youtube.com/watch?v=${resource.youtubeVideoId}`
      : "",
  );
  // An interactive video plays over an uploaded mp4 or a YouTube video (V161).
  const [videoSource, setVideoSource] = useState<"file" | "youtube">(
    resource?.resourceType === "INTERACTIVE_VIDEO"
      ? resource.youtubeVideoId
        ? "youtube"
        : "file"
      : canAuthorMedia
        ? "file"
        : "youtube",
  );
  const [interactiveVideo, setInteractiveVideo] = useState<InteractiveVideoDocument>(
    () => (resource && "interactiveVideo" in resource ? resource.interactiveVideo : null) ?? emptyDocument(),
  );
  const [interactiveEditorOpen, setInteractiveEditorOpen] = useState(false);
  // A just-uploaded mp4 previews from the local file - no round trip to the bucket for the editor.
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  useEffect(() => () => {
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
  }, [localVideoUrl]);
  const initialFrom = splitInstant(resource?.availableFrom);
  const initialUntil = splitAvailableUntil(resource?.availableUntil);
  const [availableFromDate, setAvailableFromDate] = useState(initialFrom.dateIso);
  const [availableFromTime, setAvailableFromTime] = useState(initialFrom.clockTime);
  const [availableUntilDate, setAvailableUntilDate] = useState(initialUntil.dateIso);
  const [availableUntilTime, setAvailableUntilTime] = useState(initialUntil.clockTime);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // A school resource may reach several arms of its level (e.g. JSS 1A, 1B and 1C) - one resource,
  // not a copy per class. Its home class (the one it was authored from) is always included.
  const isSchoolResource = !save;
  const homeClassId = resource && "classId" in resource ? resource.classId : classId;
  // The arms offered for the current target - kept with the request they answer, so a stale answer
  // (the author has since picked another subject) is never shown.
  const shareKey =
    isSchoolResource && homeClassId && (target.subjectId || target.subjectGroupId)
      ? `${homeClassId}|${targetKey}`
      : null;
  const [loadedArms, setLoadedArms] = useState<{ key: string; classes: SharedClassView[] } | null>(null);
  const shareableClasses = shareKey && loadedArms?.key === shareKey ? loadedArms.classes : [];
  const [sharedClassIds, setSharedClassIds] = useState<Set<string>>(
    () =>
      new Set(
        resource && "classes" in resource && resource.classes?.length
          ? resource.classes.map((sharedClass) => sharedClass.classId)
          : [homeClassId],
      ),
  );
  useEffect(() => {
    if (!shareKey) return;
    let cancelled = false;
    getShareableClasses(homeClassId, target)
      .then((classes) => {
        if (!cancelled) setLoadedArms({ key: shareKey, classes });
      })
      .catch(() => {
        // Not being able to list the other arms only hides the picker; the resource still saves for its home class.
        if (!cancelled) setLoadedArms({ key: shareKey, classes: [] });
      });
    return () => {
      cancelled = true;
    };
    // `homeClassId` and `target` are both encoded in `shareKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareKey]);

  /** The chosen arms still offered for the current target, the home class always among them. */
  function chosenClassIds(): string[] {
    const offered = new Set(shareableClasses.map((sharedClass) => sharedClass.classId));
    return [homeClassId, ...[...sharedClassIds].filter((id) => id !== homeClassId && offered.has(id))];
  }

  // A school resource may go to every pupil of its classrooms or only chosen ones (V150).
  const initialStudents = resource && "students" in resource ? (resource.students ?? []) : [];
  const [audience, setAudience] = useState<Audience>(initialStudents.length > 0 ? "SELECTED" : "ALL");
  const [chosenStudents, setChosenStudents] = useState<Set<string>>(
    () => new Set(initialStudents.map((student) => student.studentId)),
  );
  const resourceTermId = resource && "termId" in resource && resource.termId ? resource.termId : termId;
  const reachedClassIds =
    shareableClasses.length > 0
      ? chosenClassIds()
      : [homeClassId, ...[...sharedClassIds].filter((id) => id !== homeClassId)];
  // The pupils of the classrooms the resource reaches, loaded only once the author picks "Selected pupils".
  const studentsKey =
    shareKey && resourceTermId && audience === "SELECTED"
      ? `${shareKey}|${resourceTermId}|${reachedClassIds.join(",")}`
      : null;
  const [loadedStudents, setLoadedStudents] = useState<{ key: string; students: EligibleStudentView[] | null } | null>(
    null,
  );
  const eligibleStudents = studentsKey && loadedStudents?.key === studentsKey ? loadedStudents.students : null;
  useEffect(() => {
    if (!studentsKey) return;
    let cancelled = false;
    getEligibleStudents(homeClassId, target, resourceTermId, reachedClassIds)
      .then((students) => {
        if (!cancelled) setLoadedStudents({ key: studentsKey, students });
      })
      .catch(() => {
        // The chosen pupils still save as they are; the server checks every one is in the resource's classrooms.
        if (!cancelled) setLoadedStudents({ key: studentsKey, students: null });
      });
    return () => {
      cancelled = true;
    };
    // Every input is encoded in `studentsKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsKey]);

  /**
   * The chosen pupils to save - `[]` for everyone; `undefined` (leave unchanged) when the picker
   * isn't offered. Pupils of a classroom since unticked drop out of the selection.
   */
  function chosenStudentIds(): string[] | undefined {
    if (!shareKey) return undefined;
    if (audience === "ALL") return [];
    const offered = eligibleStudents ? new Set(eligibleStudents.map((student) => student.studentId)) : null;
    const chosen = [...chosenStudents].filter((id) => !offered || offered.has(id));
    if (chosen.length === 0) {
      throw new ApiError(422, "Choose at least one pupil, or send the resource to everyone.");
    }
    return chosen;
  }

  const [uploading, setUploading] = useState(false);
  // An mp3/mp4 goes up in parts straight to the bucket (`uploadMediaFile`) - this tracks its
  // progress (0-100) and lets the author cancel it; closing the form cancels it too.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  useEffect(() => () => uploadAbort.current?.abort(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInteractiveVideo = resourceType === "INTERACTIVE_VIDEO";
  const interactiveFromFile = isInteractiveVideo && videoSource === "file";
  const interactiveFromYouTube = isInteractiveVideo && videoSource === "youtube";
  // `isFileBacked`/`isMedia` cover an interactive video over an uploaded mp4 too - it uploads,
  // galleries and probes its duration exactly like a VIDEO resource.
  const isFileBacked = FILE_BACKED_TYPES.includes(resourceType) || interactiveFromFile;
  const isMedia = resourceType === "AUDIO" || resourceType === "VIDEO" || interactiveFromFile;
  const contentType = FILE_CONTENT_TYPE[resourceType];
  const interactiveYouTubeId = interactiveFromYouTube ? youTubeIdOf(youtubeUrl) : null;
  const savedMedia = useMediaStreamUrl(
    interactiveFromFile && !localVideoUrl && fileId ? fileId : undefined,
    getFileMediaUrl,
  );
  const outOfRangeCount = isInteractiveVideo ? outOfRangeIds(interactiveVideo.items, durationSeconds).size : 0;

  async function handleFileSelected(file: File | undefined) {
    if (!file || !contentType) return;
    if (file.size > uploadLimitFor(contentType)) {
      setError(`File is larger than ${uploadLimitLabel(contentType)}. Please choose a smaller file.`);
      return;
    }
    uploadAbort.current?.abort();
    const abort = new AbortController();
    uploadAbort.current = abort;
    setUploading(true);
    setError(null);
    try {
      let stored;
      if (isMedia) {
        setUploadProgress(0);
        // Declared as the type the resource expects: a browser may label an mp3 `audio/mp3`, or
        // nothing at all, and the server checks the bytes either way.
        const media = new File([file], file.name, { type: contentType });
        stored = await uploadMediaFile(media, {
          signal: abort.signal,
          onProgress: (fraction) => setUploadProgress(Math.round(fraction * 100)),
        });
      } else {
        stored = await uploadFile(file);
      }
      if (abort.signal.aborted) return;
      setFileId(stored.fileId);
      setFileName(stored.fileName);
      setDurationSeconds(null);
      if (interactiveFromFile) {
        setLocalVideoUrl(URL.createObjectURL(file));
      }
      if (isMedia) {
        const probed = await probeMediaDuration(file, resourceType === "AUDIO" ? "audio" : "video");
        setDurationSeconds(probed);
      }
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(err instanceof ApiError ? err.message : "Failed to upload file");
    } finally {
      if (uploadAbort.current === abort) {
        uploadAbort.current = null;
        setUploading(false);
        setUploadProgress(null);
      }
    }
  }

  function cancelUpload() {
    uploadAbort.current?.abort();
    uploadAbort.current = null;
    setUploading(false);
    setUploadProgress(null);
  }

  /**
   * A gallery pick already carries its own `durationSeconds` (Phase 35H interaction rows aside,
   * straight from its source resource) - never re-probed client-side like a fresh upload.
   * `GalleryPickerModal` closes itself right after calling this, so `galleryOpen` isn't touched
   * here.
   */
  function handleGalleryPick(file: LearningGalleryFileView) {
    setError(null);
    setFileId(file.fileId);
    setFileName(file.fileName);
    setDurationSeconds(isMedia ? file.durationSeconds : null);
    setLocalVideoUrl(null);
  }

  /** Switching an interactive video's source drops the other one - exactly one of the two is sent. */
  function chooseVideoSource(next: "file" | "youtube") {
    setVideoSource(next);
    setDurationSeconds(null);
    if (next === "youtube") {
      setFileId(null);
      setFileName(null);
      setLocalVideoUrl(null);
    } else {
      setYoutubeUrl("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        title,
        description: description || null,
        bodyHtml: resourceType === "RICH_TEXT" ? bodyHtml : null,
        fileId: isFileBacked ? fileId : null,
        youtubeUrl:
          resourceType === "YOUTUBE"
            ? isEdit
              ? youtubeUrl || null
              : youtubeUrl
            : interactiveFromYouTube
              ? youtubeUrl.trim()
              : null,
        durationSeconds: isMedia || isInteractiveVideo ? durationSeconds : null,
        interactiveVideo: isInteractiveVideo ? interactiveVideo : undefined,
        availableFrom: availableFromInstant(availableFromDate, availableFromTime),
        availableUntil: availableUntilInstant(availableUntilDate, availableUntilTime),
      };
      // Sent only once the arms have loaded, so a failed lookup never drops a resource's other arms.
      const classIds = shareableClasses.length > 0 ? chosenClassIds() : undefined;
      const studentIds = isSchoolResource ? chosenStudentIds() : undefined;
      if (save) {
        await save({ ...payload, resourceType: resource?.resourceType ?? resourceType });
      } else if (isEdit) {
        await updateLearningResource(resource.id, { ...payload, classIds, studentIds });
      } else {
        await createLearningResource({
          classId,
          ...target,
          termId,
          resourceType,
          ...payload,
          classIds,
          studentIds,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${isEdit ? "update" : "create"} resource`);
    } finally {
      setSubmitting(false);
    }
  }

  const availableFrom = availableFromInstant(availableFromDate, availableFromTime);
  const availableUntil = availableUntilInstant(availableUntilDate, availableUntilTime);
  const availabilityWindowInvalid =
    availableFrom !== null && availableUntil !== null && new Date(availableUntil) < new Date(availableFrom);

  const canSubmit =
    !submitting &&
    !uploading &&
    !availabilityWindowInvalid &&
    title.trim().length > 0 &&
    (resourceType !== "RICH_TEXT" || bodyHtml.trim().length > 0) &&
    (!isFileBacked || fileId != null) &&
    (resourceType !== "YOUTUBE" || (isEdit ? true : youtubeUrl.trim().length > 0)) &&
    (!interactiveFromYouTube || youtubeUrl.trim().length > 0);

  return (
    <>
      <Modal open onClose={onClose} title={isEdit ? "Edit resource" : "Add resource"} size="xxl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <Alert variant="error">{error}</Alert>}

          {!isEdit && subjects.length + subjectGroups.length > 1 && (
            <FormField label="Subject" htmlFor="resource-subject">
              <SubjectTargetSelect
                id="resource-subject"
                value={targetKey}
                onChange={setTargetKey}
                subjects={subjects}
                subjectGroups={subjectGroups}
                placeholder={null}
              />
            </FormField>
          )}

          {shareableClasses.length > 1 && (
            <ClassroomArmsField
              idPrefix="resource-class"
              classes={shareableClasses}
              homeClassId={homeClassId}
              selected={sharedClassIds}
              onChange={setSharedClassIds}
              hint="One resource for every classroom you tick - edits, publishing and comments are shared."
            />
          )}

          {(shareKey || initialStudents.length > 0) && (
            <AudienceField
              name="resource-audience"
              audience={audience}
              selected={chosenStudents}
              onChange={(next, selected) => {
                setAudience(next);
                setChosenStudents(selected);
              }}
              students={eligibleStudents ?? (shareKey ? null : initialStudents)}
              noLoginTag="no login"
              footnote={
                'Only the pupils you tick see this resource and appear in its completions. Pupils marked "no login" have no portal login, so they can\'t open it until they get one.'
              }
              disabled={!shareKey}
            />
          )}

          {!isEdit && (
            <FormField label="Type" htmlFor="resource-type">
              <Select
                id="resource-type"
                value={resourceType}
                onChange={(event) => setResourceType(event.target.value as LearningResourceType)}
              >
                <option value="RICH_TEXT">Rich text note</option>
                <option value="PDF">PDF document</option>
                <option value="YOUTUBE">YouTube video</option>
                {canAuthorMedia && <option value="AUDIO">Audio (mp3)</option>}
                {canAuthorMedia && <option value="VIDEO">Video (mp4)</option>}
                {canAuthorInteractiveVideo && <option value="INTERACTIVE_VIDEO">Interactive video</option>}
              </Select>
            </FormField>
          )}

          {isInteractiveVideo && (
            <FormField label="Video" htmlFor="resource-video-source">
              <div id="resource-video-source" role="radiogroup" className="flex flex-wrap gap-4 text-sm text-slate-800">
                {(canAuthorMedia || videoSource === "file") && (
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="resource-video-source"
                      checked={videoSource === "file"}
                      onChange={() => chooseVideoSource("file")}
                      className="h-4 w-4 text-brand-500"
                    />
                    Upload an mp4
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="resource-video-source"
                    checked={videoSource === "youtube"}
                    onChange={() => chooseVideoSource("youtube")}
                    className="h-4 w-4 text-brand-500"
                  />
                  YouTube video
                </label>
              </div>
            </FormField>
          )}

          <FormField label="Title" htmlFor="resource-title">
            <Input
              id="resource-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          <FormField label="Description" htmlFor="resource-description">
            <Textarea
              id="resource-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          {resourceType === "RICH_TEXT" && (
            <FormField label="Content" htmlFor="resource-body">
              <RichTextField
                id="resource-body"
                value={bodyHtml}
                onChange={setBodyHtml}
                allowImages
                allowHeadings
                allowTables
                allowBlockMath
                allowBlockquote
                maxImages={MAX_IMAGES_PER_RESOURCE}
                ariaLabel="Resource content"
              />
            </FormField>
          )}

          {isFileBacked && contentType && (
            <FormField label="File" htmlFor="resource-file">
              <p className="mb-2 text-sm text-slate-500">
                {resourceType === "PDF" ? "PDF" : resourceType === "AUDIO" ? "mp3" : "mp4"} only ·
                max {uploadLimitLabel(contentType)}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="resource-file"
                  type="file"
                  accept={contentType}
                  onChange={(event) => handleFileSelected(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={uploading}
                  onClick={() => setGalleryOpen(true)}
                >
                  Choose from gallery
                </Button>
                {uploading && uploadProgress === null && (
                  <span className="text-sm text-slate-500">Uploading…</span>
                )}
              </div>
              {uploading && uploadProgress !== null && (
                <div className="mt-3 flex items-center gap-3" aria-live="polite">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label="Upload progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={uploadProgress}
                    >
                      <div
                        className="h-full bg-brand-500 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {uploadProgress < 100 ? `Uploading ${uploadProgress}%` : "Checking file…"}
                    </p>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={cancelUpload}>
                    Cancel upload
                  </Button>
                </div>
              )}
              <div className="mt-3">
                {!uploading && fileId && (
                  <p className="text-sm text-slate-600">
                    Selected:{" "}
                    <span className="font-medium text-slate-900">
                      {fileName ?? "File uploaded"}
                    </span>
                    {isMedia && durationSeconds != null && ` · ${formatDuration(durationSeconds)}`}
                  </p>
                )}
              </div>
            </FormField>
          )}

          {(resourceType === "YOUTUBE" || interactiveFromYouTube) && (
            <FormField
              label="YouTube URL"
              htmlFor="resource-youtube"
              description={
                isEdit && !isInteractiveVideo
                  ? "Leave blank to keep the current video."
                  : "A full youtube.com or youtu.be link."
              }
            >
              <Input
                id="resource-youtube"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(event) => {
                  setYoutubeUrl(event.target.value);
                  // A different video has a different length - measured again when the editor opens.
                  if (isInteractiveVideo) setDurationSeconds(null);
                }}
              />
            </FormField>
          )}

          {isInteractiveVideo && (
            <FormField label="Interactions" htmlFor="resource-interactions">
              {/* The id sits on the wrapper, not the button - a <label> would rename the button "Interactions". */}
              <div id="resource-interactions" className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={uploading || (interactiveFromFile ? !fileId : !interactiveYouTubeId)}
                  onClick={() => setInteractiveEditorOpen(true)}
                >
                  {interactiveVideo.items.length > 0 ? "Edit interactions" : "Add interactions"}
                </Button>
                <span className="text-sm text-slate-600">
                  {interactiveVideo.items.length} item{interactiveVideo.items.length === 1 ? "" : "s"}
                  {durationSeconds != null && ` · video ${formatDuration(durationSeconds)}`}
                </span>
              </div>
              {(interactiveFromFile ? !fileId : !interactiveYouTubeId) && (
                <p className="mt-2 text-xs text-slate-500">
                  {interactiveFromFile ? "Upload or choose the video first." : "Enter the video's YouTube link first."}
                </p>
              )}
              {outOfRangeCount > 0 && (
                <Alert variant="warning" className="mt-3">
                  {outOfRangeCount} item{outOfRangeCount === 1 ? "" : "s"} fall{outOfRangeCount === 1 ? "s" : ""} after
                  the end of this video. They&apos;re kept, but the resource can&apos;t be published until they&apos;re
                  moved inside it.
                </Alert>
              )}
            </FormField>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Available from"
              htmlFor="resource-available-from"
              description="Leave blank for no start limit. A blank time means midnight."
            >
              <div className="flex gap-2">
                <DateInput
                  id="resource-available-from"
                  value={availableFromDate}
                  onChange={(value) => {
                    setAvailableFromDate(value);
                    if (!value) setAvailableFromTime("");
                  }}
                  max={availableUntilDate || undefined}
                />
                <Input
                  type="time"
                  aria-label="Available from time"
                  value={availableFromTime}
                  onChange={(event) => setAvailableFromTime(event.target.value)}
                  disabled={!availableFromDate}
                />
              </div>
            </FormField>
            <FormField
              label="Available until"
              htmlFor="resource-available-until"
              description={`${audienceLabel} only see this resource within this window. Leave blank for no end limit; a blank time means the end of that day.`}
            >
              <div className="flex gap-2">
                <DateInput
                  id="resource-available-until"
                  value={availableUntilDate}
                  onChange={(value) => {
                    setAvailableUntilDate(value);
                    if (!value) setAvailableUntilTime("");
                  }}
                  min={availableFromDate || undefined}
                />
                <Input
                  type="time"
                  aria-label="Available until time"
                  value={availableUntilTime}
                  onChange={(event) => setAvailableUntilTime(event.target.value)}
                  disabled={!availableUntilDate}
                />
              </div>
            </FormField>
          </div>
          {availabilityWindowInvalid && (
            <Alert variant="error">The availability end cannot be before its start.</Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add resource"}
            </Button>
          </div>
        </form>
      </Modal>
      {interactiveEditorOpen && (
        <InteractiveVideoEditor
          initial={interactiveVideo}
          title={title || "Interactive video"}
          source={
            interactiveFromFile
              ? { kind: "file", url: localVideoUrl ?? savedMedia.url, error: savedMedia.error, onUrlExpired: savedMedia.refresh }
              : { kind: "youtube", videoId: interactiveYouTubeId ?? "" }
          }
          durationSeconds={durationSeconds}
          serverProblems={resource && "interactiveVideoProblems" in resource ? resource.interactiveVideoProblems : []}
          renderImage={renderStaffImage}
          onDuration={setDurationSeconds}
          onDone={(document) => {
            setInteractiveVideo(document);
            setInteractiveEditorOpen(false);
          }}
          onCancel={() => setInteractiveEditorOpen(false)}
        />
      )}
      {galleryOpen && isFileBacked && (
        <GalleryPickerModal
          classId={classId}
          subjectId={target.subjectId}
          subjectGroupId={target.subjectGroupId}
          // An interactive video's mp4 comes from the same gallery as a VIDEO resource's.
          resourceType={interactiveFromFile ? "VIDEO" : resourceType}
          selectedFileId={fileId}
          loadPage={loadGallery}
          onPick={handleGalleryPick}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </>
  );
}
