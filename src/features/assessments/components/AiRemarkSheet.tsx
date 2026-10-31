import { Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import type { GenerateRemarkHandlers } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import type { AiRemarkCopy } from "@/features/lessonNotes/components/aiGenerateCopy";

interface AiRemarkSheetProps {
  studentName: string;
  /** Starts the streamed draft - `generateRemarkDraft`, closed over the class, term, scope and enrollment. */
  generate: (
    extraInstructions: string | null,
    handlers: GenerateRemarkHandlers,
    signal: AbortSignal,
  ) => Promise<void>;
  copy: AiRemarkCopy;
  onClose: () => void;
  /** Puts the draft into the pupil's remark field - the teacher still edits and saves it. */
  onApply: (remark: string) => void;
}

type Status = "idle" | "streaming" | "done" | "error";

/**
 * Streams an AI-drafted class-teacher remark into a preview, then hands it to the remarks grid on
 * "Use this" (insights Phase I5). A small sibling of the lesson-note `AiGenerateSheet`: a remark is
 * plain prose, so there's no topic, no hint, and no parsed read view - the cleaned-up `result` text is
 * the preview once it arrives.
 */
export function AiRemarkSheet({
  studentName,
  generate: startGeneration,
  copy,
  onClose,
  onApply,
}: AiRemarkSheetProps) {
  const [extraInstructions, setExtraInstructions] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [previewText, setPreviewText] = useState("");
  const [remark, setRemark] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streaming = status === "streaming";

  async function generate() {
    setStatus("streaming");
    setError(null);
    setPreviewText("");
    setRemark(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      await startGeneration(
        extraInstructions.trim() || null,
        {
          onDelta: (text) => setPreviewText((prev) => prev + text),
          onResult: (draft) => {
            setRemark(draft);
            setStatus("done");
          },
          onError: (detail) => {
            setError(detail);
            setStatus("error");
          },
        },
        controller.signal,
      );
    } catch (caught) {
      if (controller.signal.aborted) {
        // A user-initiated Stop, not a real failure.
        setStatus("idle");
        return;
      }
      setError(
        caught instanceof ApiError ? caught.message : "AI drafting failed. Please try again.",
      );
      setStatus("error");
    } finally {
      abortControllerRef.current = null;
    }
  }

  function stop() {
    abortControllerRef.current?.abort();
  }

  function useThis() {
    if (remark === null) {
      return;
    }
    onApply(remark);
    onClose();
  }

  const preview = status === "done" && remark !== null ? remark : previewText;

  return (
    <Modal
      open
      onClose={streaming ? stop : onClose}
      title={`AI draft for ${studentName}`}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{copy.description}</p>

        {error && <Alert variant="error">{error}</Alert>}

        <FormField label="Extra instructions (optional)" htmlFor="ai-remark-extra-instructions">
          <Textarea
            id="ai-remark-extra-instructions"
            rows={2}
            maxLength={500}
            value={extraInstructions}
            onChange={(event) => setExtraInstructions(event.target.value)}
            disabled={streaming}
            placeholder={copy.extraInstructionsPlaceholder}
          />
        </FormField>

        {(streaming || status === "done" || (status === "error" && previewText)) && (
          <FormField label="Preview">
            <p
              aria-live="polite"
              className="min-h-16 whitespace-pre-wrap rounded-control border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
            >
              {preview}
            </p>
          </FormField>
        )}

        <div
          data-sheet-dock
          className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 mobile:sticky mobile:bottom-0 mobile:-mx-6 mobile:bg-white/95 mobile:px-6 mobile:pb-4 mobile:backdrop-blur"
        >
          {streaming ? (
            <>
              <Button type="button" variant="secondary" onClick={stop}>
                Stop
              </Button>
              <Button type="button" variant="primary" loading>
                Drafting…
              </Button>
            </>
          ) : status === "done" ? (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button type="button" variant="secondary" onClick={generate}>
                Regenerate
              </Button>
              <Button type="button" variant="primary" onClick={useThis}>
                Use this
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={generate}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {status === "error" ? "Try again" : "Draft remark"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
