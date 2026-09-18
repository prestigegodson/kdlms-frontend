import { useRef, type ReactNode } from "react";
import { RichContent } from "@/components/richText/RichContent";
import { Spinner } from "@/components/ui/Spinner";
import { formatBytes } from "@/utils/duration";
import type { LearningResourceType } from "@/api/learning";

//const DOWNLOAD_LINK_CLASSES = "inline-flex items-center justify-center gap-1.5 rounded-control border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 mobile:min-h-11";

/**
 * The one-resource payload switch, shared by the student portal's own read
 * (`StudentResourceDetailPage`) and the staff preview
 * (`LearningResourcePreviewPage`) - the two callers differ only in how they
 * resolve `fileUrl` (the student fetches by `resourceId` through its own
 * narrow `/me/learning-resources/{id}/file` endpoint; staff fetch by
 * `fileId` through the authenticated `/api/v1/files/{id}` proxy, which a
 * `STUDENT` may never reach), so all blob-fetching stays with each caller
 * and this component only renders what it's handed.
 *
 * `renderImage` is optional - the student caller omits it (a `STUDENT` has
 * no access to `/api/v1/files/{id}`, so an embedded rich-text image is
 * silently dropped rather than 403ing the whole resource, the guardian
 * document-mode-note precedent); the staff caller passes
 * `AuthenticatedRichImage`, so staff genuinely see images the student
 * viewer can't - a deliberate asymmetry, not a gap to "fix".
 *
 * `onLoadedMetadata`/`onTimeUpdate` are optional too - only the student
 * caller wires resume-seek and a throttled position autosave onto them;
 * the staff preview passes neither, since a resource-interaction row is a
 * `STUDENT`'s own, never staff's.
 */
export function ResourceViewer({
  resourceType,
  title,
  bodyHtml,
  youtubeVideoId,
  renderImage,
  fileUrl,
  fileError = false,
  loadedBytes,
  totalBytes,
  downloadName,
  initialPositionSeconds,
  onLoadedMetadata,
  onTimeUpdate,
}: {
  resourceType: LearningResourceType;
  title: string;
  bodyHtml?: string | null;
  youtubeVideoId?: string | null;
  renderImage?: (fileId: string, alt: string) => ReactNode;
  fileUrl: string | null;
  /** `AUDIO`/`VIDEO` only, from `useMediaObjectUrl` - `useObjectUrl` (the `PDF` fetcher) tracks no error state of its own, so a `PDF` caller never passes this. */
  fileError?: boolean;
  loadedBytes: number;
  totalBytes: number | null;
  downloadName: string;
  initialPositionSeconds?: number | null;
  onLoadedMetadata?: () => void;
  onTimeUpdate?: (positionSeconds: number) => void;
}) {
  return (
    <>
      {resourceType === "RICH_TEXT" && (
        <RichContent html={bodyHtml ?? ""} renderImage={renderImage} className="space-y-3 text-sm text-slate-700" />
      )}

      {resourceType === "PDF" &&
        (fileUrl ? (
          <div className="space-y-3">
            <iframe src={fileUrl} title={title} className="h-[80vh] w-full rounded-card border border-slate-200" />
            {/*<a href={fileUrl} download={`${title}.pdf`} className={DOWNLOAD_LINK_CLASSES}>*/}
            {/*  Download*/}
            {/*</a>*/}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading document…
          </div>
        ))}

      {(resourceType === "AUDIO" || resourceType === "VIDEO") && (
        <MediaPlayer
          resourceType={resourceType}
          title={title}
          url={fileUrl}
          error={fileError}
          loadedBytes={loadedBytes}
          totalBytes={totalBytes}
          downloadName={downloadName}
          initialPositionSeconds={initialPositionSeconds ?? null}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
        />
      )}

      {resourceType === "YOUTUBE" && youtubeVideoId && (
        <div className="aspect-video w-full overflow-hidden rounded-card border border-slate-200">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
            title={title}
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}
    </>
  );
}

/**
 * The `AUDIO`/`VIDEO` payload's player: a determinate download progress bar while the blob is
 * still streaming in (once `totalBytes` is known - from the response's own `Content-Length`, or a
 * caller's own fallback estimate before the first byte arrives), then the native
 * `<audio>`/`<video>` element once the object URL is ready. Playback only starts once the whole
 * file has downloaded (`useMediaObjectUrl`'s known limit - see student-portal-plan.md); seeking
 * within the in-memory blob works normally once it does.
 * <p>
 * `onLoadedMetadata`/`onTimeUpdate` are the student caller's resume-seek and throttled position
 * autosave hooks - both optional, since the staff preview has no interaction row to save against.
 */
function MediaPlayer({
  resourceType,
  title,
  url,
  error,
  loadedBytes,
  totalBytes,
  //downloadName,
  initialPositionSeconds,
  onLoadedMetadata,
  onTimeUpdate,
}: {
  resourceType: "AUDIO" | "VIDEO";
  title: string;
  url: string | null;
  error: boolean;
  loadedBytes: number;
  totalBytes: number | null;
  downloadName: string;
  initialPositionSeconds: number | null;
  onLoadedMetadata?: () => void;
  onTimeUpdate?: (positionSeconds: number) => void;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  // A plain callback ref, not a `useRef` object directly - `<audio>`/`<video>` each require their
  // own specific element type, and this single ref backs both (contravariant callback-ref
  // assignment makes a shared `HTMLMediaElement | null` setter valid for either).
  function setMediaRef(node: HTMLMediaElement | null) {
    mediaRef.current = node;
  }

  if (error) {
    return <p className="text-sm text-red-600">Failed to load this file. Please try again.</p>;
  }

  if (!url) {
    const percent = totalBytes ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : null;
    return (
      <div className="space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width]"
            style={{ width: `${percent ?? 8}%` }}
          />
        </div>
        <p className="text-sm text-slate-500">
          {percent != null
            ? `Downloading… ${percent}% · ${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)}`
            : `Downloading… ${formatBytes(loadedBytes) ?? "0 B"}`}
        </p>
      </div>
    );
  }

  function handleLoadedMetadata() {
    if (initialPositionSeconds && mediaRef.current) {
      mediaRef.current.currentTime = initialPositionSeconds;
    }
    onLoadedMetadata?.();
  }

  function handleTimeUpdate() {
    if (mediaRef.current) {
      onTimeUpdate?.(Math.floor(mediaRef.current.currentTime));
    }
  }

  return (
    <div className="space-y-3">
      {resourceType === "AUDIO" ? (
        <audio
          ref={setMediaRef}
          controls
          preload="metadata"
          className="w-full"
          src={url}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
        >
          Your browser doesn't support audio playback.
        </audio>
      ) : (
        <video
          ref={setMediaRef}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-card border border-slate-200 bg-black"
          src={url}
          title={title}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
        >
          Your browser doesn't support video playback.
        </video>
      )}
      {/*<a href={url} download={downloadName} className={DOWNLOAD_LINK_CLASSES}>*/}
      {/*  Download*/}
      {/*</a>*/}
    </div>
  );
}
