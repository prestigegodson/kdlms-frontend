import type { ReactNode } from "react";
import type {
  AnswerCommand,
  AttemptClockView,
  QuizAttemptView,
  SubmitConfirmationView,
} from "@/api/publicTakeHomeQuiz";

/**
 * What `QuizRunner` needs from whichever entry point is hosting it - the public token page
 * (`TakeHomeQuizPublicPage`) or the portal (`StudentQuizPage`). Each page builds one of these once
 * an attempt has started and hands it to `<QuizRunner transport={...} .../>`; everything network-
 * and auth-specific (token vs. Bearer header, which endpoints) lives in the transport, never in
 * `QuizRunner` itself.
 */
export interface QuizTransport {
  /** A stable per-attempt key for the localStorage write-behind buffer - see `QuizRunner`'s own doc comment on its `bufferKey` prop. */
  bufferKey: string;
  saveAnswers: (answers: AnswerCommand[]) => Promise<QuizAttemptView>;
  /** `answers` is the full on-screen state, saved server-side with the submit itself. */
  submit: (answers: AnswerCommand[]) => Promise<SubmitConfirmationView>;
  /**
   * Keeps a pause-on-leave attempt's clock running and returns it (V152) - only called when the
   * attempt's `pauseTimerOnLeave` is on. Omitted by the in-memory preview, which has no server clock.
   */
  heartbeat?: () => Promise<AttemptClockView>;
  /** Stops a pause-on-leave attempt's clock as the page goes away - fire-and-forget, sent with `keepalive`. */
  pause?: () => Promise<AttemptClockView>;
  /** See `QuestionCard`'s own `renderImage` prop. */
  renderQuestionImage: (fileId: string, alt: string, size: "prompt" | "option") => ReactNode;
}
