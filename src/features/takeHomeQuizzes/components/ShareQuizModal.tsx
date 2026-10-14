import {
  getQuizShareTargetSubjects,
  getQuizShareTargets,
  type QuizShareResultView,
  type QuizType,
  shareTakeHomeQuiz,
} from "@/api/takeHomeQuizzes";
import { ShareToClassModal } from "@/features/academics/components/ShareToClassModal";

interface ShareQuizModalProps {
  /** The quiz to share - mount the modal only while sharing, so each opening starts fresh. */
  quiz: { id: string; title: string; quizType: QuizType };
  onClose: () => void;
  onShared: (result: QuizShareResultView) => void;
}

/**
 * Sends a copy of a CBT/quiz to another class (level) of its branch and publishes it straight away
 * - see {@link ShareToClassModal}. A Midterm quiz keeps its type, so its copy reaches a single
 * classroom and is filed under a subject that can take a midterm score.
 */
export function ShareQuizModal({ quiz, onClose, onShared }: ShareQuizModalProps) {
  const midterm = quiz.quizType === "MIDTERM";
  return (
    <ShareToClassModal
      item={quiz}
      noun="quiz"
      loadTargets={getQuizShareTargets}
      loadSubjects={getQuizShareTargetSubjects}
      share={shareTakeHomeQuiz}
      singleClassroom={midterm}
      noSubjectsMessage={midterm ? "No subject in this class can take a midterm score." : undefined}
      footnote={
        <>
          The copy is published straight away with the same questions, settings and open/close dates, and guardians
          of pupils without a portal login are emailed their links.{" "}
          {midterm && "A midterm quiz is shared with one classroom at a time. "}
          That class&apos;s teachers manage it from then on, and your later edits won&apos;t carry over.
        </>
      }
      onClose={onClose}
      onShared={onShared}
    />
  );
}
