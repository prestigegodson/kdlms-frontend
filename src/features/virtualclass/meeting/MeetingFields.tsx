import type { MeetingMode } from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { DIRECT_VIDEO_LABEL, MAX_MEETING_URL_LENGTH, PLATFORM_VIDEO_LABEL } from "./meetingLink";

interface MeetingFieldsProps {
  /** Distinguishes the radio group and ids when two forms could be on screen. */
  idPrefix: string;
  legend: string;
  mode: MeetingMode;
  url: string;
  onModeChange: (mode: MeetingMode) => void;
  onUrlChange: (url: string) => void;
  /** Whether the plan includes the built-in video room. */
  platformVideo: boolean;
  /**
   * Whether free one-on-one video is switched on for the platform (`CreatorPlanView.directVideo`).
   * Off, the option is hidden - unless this setup already uses it, which then reads as unavailable.
   */
  directVideo?: boolean;
  /** Shown under the link field - set once the creator has tried to save. */
  urlError?: string | null;
}

/**
 * Where a class's (or one session's) meetings are held: Platform Video Conferencing, when the plan
 * includes it, or the creator's own Google Meet/Zoom link. Without the feature the platform option
 * stays visible but disabled, so a class still set to it after a downgrade reads as what it is.
 * One-on-one video is free on every plan, for the creator and exactly one learner.
 */
export function MeetingFields({
  idPrefix,
  legend,
  mode,
  url,
  onModeChange,
  onUrlChange,
  platformVideo,
  directVideo = false,
  urlError,
}: MeetingFieldsProps) {
  const name = `${idPrefix}-meeting-mode`;
  const urlId = `${idPrefix}-meeting-url`;
  const directId = `${idPrefix}-meeting-direct`;
  const showDirect = directVideo || mode === "DIRECT";
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium text-slate-700">{legend}</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
        <label
          className={`flex items-center gap-2 text-sm ${platformVideo ? "text-slate-700" : "text-slate-400"}`}
        >
          <input
            type="radio"
            name={name}
            checked={mode === "PLATFORM"}
            disabled={!platformVideo}
            onChange={() => onModeChange("PLATFORM")}
          />
          {PLATFORM_VIDEO_LABEL}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name={name}
            checked={mode === "EXTERNAL"}
            onChange={() => onModeChange("EXTERNAL")}
          />
          Google Meet or Zoom link
        </label>
        {showDirect && (
          <label className={`flex items-center gap-2 text-sm ${directVideo ? "text-slate-700" : "text-slate-400"}`}>
            <input
              type="radio"
              name={name}
              checked={mode === "DIRECT"}
              disabled={!directVideo}
              aria-describedby={`${directId}-description`}
              onChange={() => onModeChange("DIRECT")}
            />
            {DIRECT_VIDEO_LABEL} (free)
          </label>
        )}
      </div>
      {mode === "DIRECT" &&
        (directVideo ? (
          <p id={`${directId}-description`} className="text-xs text-slate-500">
            Just you and one learner. Uses no plan minutes.
          </p>
        ) : (
          <Alert variant="warning">
            <span id={`${directId}-description`}>
              {DIRECT_VIDEO_LABEL} is currently unavailable, so these sessions can't be joined. Choose another way to
              hold them.
            </span>
          </Alert>
        ))}
      {!platformVideo &&
        (mode === "PLATFORM" ? (
          <Alert variant="warning">
            Your plan no longer includes {PLATFORM_VIDEO_LABEL}, so these sessions can't be joined. Add a Google Meet or
            Zoom link, or upgrade your plan.
          </Alert>
        ) : mode === "EXTERNAL" ? (
          <p className="text-xs text-slate-500">
            {PLATFORM_VIDEO_LABEL} isn't included in your plan - upgrade to host sessions without an outside meeting
            app.
          </p>
        ) : null)}
      {mode === "EXTERNAL" && (
        <FormField
          label="Meeting link"
          htmlFor={urlId}
          description="Paste your Google Meet or Zoom link. Learners get it only when they join, never by email."
          error={urlError ?? undefined}
        >
          <Input
            id={urlId}
            type="url"
            inputMode="url"
            placeholder="https://meet.google.com/abc-defg-hij"
            maxLength={MAX_MEETING_URL_LENGTH}
            aria-describedby={`${urlId}-description`}
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </FormField>
      )}
    </fieldset>
  );
}
