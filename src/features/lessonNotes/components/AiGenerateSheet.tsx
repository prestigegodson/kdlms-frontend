import { Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { generateLessonNote, type LessonNoteContentView } from "@/api/lessonNotes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { LessonNoteReadView } from "@/features/lessonNotes/components/LessonNoteReadView";

interface AiGenerateSheetProps {
  subjectId: string;
  termId: string;
  weekNumber: number;
  /** Pre-fills the sheet's own Topic field from whatever the teacher has already typed in the main form, if anything. */
  initialTopic: string;
  onClose: () => void;
  /** Applies the generated result to the editor form - the teacher still reviews and saves it themselves (see `GenerateLessonNoteUseCase`'s own Javadoc: generation persists nothing but a usage row). */
  onApply: (topic: string, content: LessonNoteContentView) => void;
}

type Status = "idle" | "streaming" | "done" | "error";

/**
 * A `Modal`-as-sheet that streams an AI-drafted lesson note into a live preview pane, then hands
 * the parsed result to the editor form on "Use this" - Phase 16E's AI generation UX. The editor's
 * own "Generate with AI" trigger button is the `accent` CTA for the whole screen (per the style
 * guide's 60/30/10 balance - `LessonNoteEditorPage` accordingly renders its Save button as
 * `primary` via `UnsavedChangesBar`'s `saveVariant` override); this sheet's own internal actions
 * stay `primary`/`secondary`, the same "trigger is accent, the dialog's own submit isn't"
 * convention `LevelsPage`'s `LevelForm`, `ReviewDecisionModal`, and `ComposeNoteSheet` all follow.
 */
export function AiGenerateSheet({
  subjectId,
  termId,
  weekNumber,
  initialTopic,
  onClose,
  onApply,
}: AiGenerateSheetProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [classHint, setClassHint] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [previewText, setPreviewText] = useState("");
  const [resultContent, setResultContent] = useState<LessonNoteContentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streaming = status === "streaming";

  async function generate() {
    if (!topic.trim()) {
      setError("A topic is required before generating.");
      return;
    }
    setStatus("streaming");
    setError(null);
    setPreviewText("");
    setResultContent(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      await generateLessonNote(
        subjectId,
        termId,
        weekNumber,
        {
          topic: topic.trim(),
          classHint: classHint.trim() || null,
          extraInstructions: extraInstructions.trim() || null,
        },
        {
          onDelta: (text) => setPreviewText((prev) => prev + text),
          onResult: (content) => {
            setResultContent(content);
            setStatus("done");
          },
          onError: (detail) => {
            setError(detail);
            setStatus("error");
          },
        },
        { signal: controller.signal },
      );
    } catch (caught) {
      if (controller.signal.aborted) {
        // A user-initiated Stop, not a real failure - just return to the form, nothing to report.
        setStatus("idle");
        return;
      }
      setError(
        caught instanceof ApiError ? caught.message : "AI generation failed. Please try again.",
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
    if (!resultContent) {
      return;
    }
    onApply(topic.trim(), resultContent);
    onClose();
  }

  return (
    <Modal open onClose={streaming ? stop : onClose} title="Generate with AI" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Drafts a lesson note aligned to the Nigerian NERDC/UBE curriculum. Review and adjust it
          before saving - this doesn't save anything on its own.
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        <FormField label="Topic" htmlFor="ai-generate-topic">
          <Input
            id="ai-generate-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            disabled={streaming}
            required
            placeholder="e.g. Addition of fractions"
          />
        </FormField>

        <FormField label="Class (optional)" htmlFor="ai-generate-class-hint">
          <Input
            id="ai-generate-class-hint"
            value={classHint}
            onChange={(event) => setClassHint(event.target.value)}
            disabled={streaming}
            placeholder="e.g. JSS 2 - narrows the curriculum level if this level spans more than one Nigerian class"
          />
        </FormField>

        <FormField label="Extra instructions (optional)" htmlFor="ai-generate-extra-instructions">
          <Textarea
            id="ai-generate-extra-instructions"
            rows={2}
            value={extraInstructions}
            onChange={(event) => setExtraInstructions(event.target.value)}
            disabled={streaming}
            placeholder="Anything else the note should emphasize"
          />
        </FormField>

        {status === "done" && resultContent ? (
          // Once parsing succeeds, swap to the same rendered read view every other read
          // surface uses - the raw `##`/`\( ... \)` markers the model streamed are correct
          // input for the parser but not something a teacher should have to read past.
          <FormField label="Preview">
            <div className="max-h-64 overflow-y-auto overscroll-contain rounded-control border border-slate-200 bg-slate-50 p-3">
              <LessonNoteReadView content={resultContent} />
            </div>
          </FormField>
        ) : (
          (streaming || (status === "error" && previewText)) && (
            <FormField label="Preview">
              <div className="max-h-64 overflow-y-auto overscroll-contain rounded-control border border-slate-200 bg-slate-50 p-3">
                {/* Raw model text while streaming - per-chunk cleanup is unsafe, since a
                    heading/delimiter marker can straddle two delta chunks. */}
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">
                  {previewText}
                </pre>
              </div>
            </FormField>
          )
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
                Generating…
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
                {status === "error" ? "Try again" : "Generate"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
