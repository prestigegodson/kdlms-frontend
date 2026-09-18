import type { ReactNode } from "react";
import type { AnswerCommand, QuizAttemptView, SubmitConfirmationView } from "@/api/publicTakeHomeQuiz";

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
  submit: () => Promise<SubmitConfirmationView>;
  /** See `QuestionCard`'s own `renderImage` prop. */
  renderQuestionImage: (fileId: string, alt: string, size: "prompt" | "option") => ReactNode;
}
