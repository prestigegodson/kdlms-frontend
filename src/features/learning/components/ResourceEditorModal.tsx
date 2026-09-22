import { type FormEvent, useState } from "react";
import { ApiError } from "@/api/client";
import { uploadFile, uploadLimitFor, uploadLimitLabel } from "@/api/files";
import {
  type AuthorableSubjectView,
  createLearningResource,
  type LearningGalleryFileView,
  type LearningResourceType,
  type LearningResourceView,
  updateLearningResource,
} from "@/api/learning";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { RichTextField } from "@/components/richText/RichTextField";
import { GalleryPickerModal } from "@/features/learning/components/GalleryPickerModal";
import { formatDuration } from "@/utils/duration";

/** Mirrors backend `learning.domain.LearningRichText.MAX_IMAGES_PER_RESOURCE`. */
const MAX_IMAGES_PER_RESOURCE = 30;

/** The content type each file-backed resource type's upload must declare - mirrors backend `LearningResourceType.expectedContentType`. */
const FILE_CONTENT_TYPE: Record<string, string> = {
  PDF: "application/pdf",
  AUDIO: "audio/mpeg",
  VIDEO: "video/mp4",
};

const FILE_BACKED_TYPES: LearningResourceType[] = ["PDF", "AUDIO", "VIDEO"];

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

interface ResourceEditorModalProps {
  classId: string;
  subjectId: string;
  termId: string;
  subjects: AuthorableSubjectView[];
  /** Present -> edit an existing resource. Absent -> create a new one, in `subjectId` above. */
  resource?: LearningResourceView;
  /** Whether the caller may author an `AUDIO`/`VIDEO` resource - `can.authorLearningMedia` (Phase 35F), evaluated by the parent since it needs the `learningMedia` feature flag. */
  canAuthorMedia: boolean;
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
  subjectId,
  termId,
  subjects,
  resource,
  canAuthorMedia,
  onClose,
  onSaved,
}: ResourceEditorModalProps) {
  const isEdit = resource != null;
  const [targetSubjectId, setTargetSubjectId] = useState(resource?.subjectId ?? subjectId);
  const [resourceType, setResourceType] = useState<LearningResourceType>(resource?.resourceType ?? "RICH_TEXT");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [bodyHtml, setBodyHtml] = useState(resource?.bodyHtml ?? "");
  const [fileId, setFileId] = useState<string | null>(resource?.fileId ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(resource?.durationSeconds ?? null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFileBacked = FILE_BACKED_TYPES.includes(resourceType);
  const isMedia = resourceType === "AUDIO" || resourceType === "VIDEO";
  const contentType = FILE_CONTENT_TYPE[resourceType];

  async function handleFileSelected(file: File | undefined) {
    if (!file || !contentType) return;
    if (file.size > uploadLimitFor(contentType)) {
      setError(`File is larger than ${uploadLimitLabel(contentType)}. Please choose a smaller file.`);
      return;
    }
    setUploading(true);
    setError(null);
    setDurationSeconds(null);
    try {
      const stored = await uploadFile(file);
      setFileId(stored.fileId);
      setFileName(stored.fileName);
      if (isMedia) {
        const probed = await probeMediaDuration(file, resourceType === "AUDIO" ? "audio" : "video");
        setDurationSeconds(probed);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
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
        youtubeUrl: resourceType === "YOUTUBE" ? (isEdit ? youtubeUrl || null : youtubeUrl) : null,
        durationSeconds: isMedia ? durationSeconds : null,
      };
      if (isEdit) {
        await updateLearningResource(resource.id, payload);
      } else {
        await createLearningResource({
          classId,
          subjectId: targetSubjectId,
          termId,
          resourceType,
          ...payload,
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

  const canSubmit =
    !submitting &&
    !uploading &&
    title.trim().length > 0 &&
    (resourceType !== "RICH_TEXT" || bodyHtml.trim().length > 0) &&
    (!isFileBacked || fileId != null) &&
    (resourceType !== "YOUTUBE" || (isEdit ? true : youtubeUrl.trim().length > 0));

  return (
    <>
      <Modal open onClose={onClose} title={isEdit ? "Edit resource" : "Add resource"} size="xl">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <Alert variant="error">{error}</Alert>}

          {!isEdit && subjects.length > 1 && (
            <FormField label="Subject" htmlFor="resource-subject">
              <Select
                id="resource-subject"
                value={targetSubjectId}
                onChange={(event) => setTargetSubjectId(event.target.value)}
              >
                {subjects.map((subject) => (
                  <option key={subject.subjectId} value={subject.subjectId}>
                    {subject.subjectName}
                  </option>
                ))}
              </Select>
            </FormField>
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
              </Select>
            </FormField>
          )}

          <FormField label="Title" htmlFor="resource-title">
            <Input id="resource-title" required value={title} onChange={(event) => setTitle(event.target.value)} />
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
                {resourceType === "PDF" ? "PDF" : resourceType === "AUDIO" ? "mp3" : "mp4"} only · max{" "}
                {uploadLimitLabel(contentType)}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="resource-file"
                  type="file"
                  accept={contentType}
                  onChange={(event) => handleFileSelected(event.target.files?.[0])}
                />
                <Button type="button" variant="secondary" disabled={uploading} onClick={() => setGalleryOpen(true)}>
                  Choose from gallery
                </Button>
                {uploading && <span className="text-sm text-slate-500">Uploading…</span>}
              </div>
              <div className="mt-3">
                {!uploading && fileId && (
                  <p className="text-sm text-slate-600">
                    Selected: <span className="font-medium text-slate-900">{fileName ?? "File uploaded"}</span>
                    {isMedia && durationSeconds != null && ` · ${formatDuration(durationSeconds)}`}
                  </p>
                )}
              </div>
            </FormField>
          )}

          {resourceType === "YOUTUBE" && (
            <FormField
              label="YouTube URL"
              htmlFor="resource-youtube"
              description={
                isEdit ? "Leave blank to keep the current video." : "A full youtube.com or youtu.be link."
              }
            >
              <Input
                id="resource-youtube"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
              />
            </FormField>
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
      {galleryOpen && isFileBacked && (
        <GalleryPickerModal
          classId={classId}
          subjectId={targetSubjectId}
          resourceType={resourceType}
          selectedFileId={fileId}
          onPick={handleGalleryPick}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </>
  );
}
