import { useState } from "react";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import { pluginFor } from "@/features/takeHomeQuizzes/interactions/registry";
import type { ScoreResult } from "@/features/takeHomeQuizzes/interactions/types";

interface TryInteractionModalProps {
  question: EditableQuestion;
  onClose: () => void;
}

/**
 * The author's "Try it" preview of an interactive question (interaction-quiz.md §8): the student's
 * own player, shuffled as a student would see it, scored by the plugin's TS scorer so a teacher can
 * check their answer key before publishing. The server re-scores every real attempt itself.
 */
export function TryInteractionModal({ question, onClose }: TryInteractionModalProps) {
  const plugin = pluginFor(question.questionType);
  const [playerConfig] = useState(() => (plugin ? plugin.toPlayerView(question.interaction) : null));
  const [response, setResponse] = useState<object | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);

  if (!plugin || !playerConfig) {
    return null;
  }
  const { Player } = plugin;
  const points = Number(question.points) || 0;

  return (
    <Modal open onClose={onClose} title="Try this question" size="lg">
      <div className="space-y-4">
        <Player
          config={playerConfig}
          value={response}
          onChange={(next: object) => {
            setResponse(next);
            setResult(null);
          }}
          disabled={false}
          renderImage={(fileId, alt) => <AuthenticatedRichImage fileId={fileId} alt={alt} />}
        />
        {result && (
          <Alert variant={result.awarded === result.max ? "success" : "info"}>
            You would score {result.awarded} of {result.max} {result.max === 1 ? "point" : "points"} (
            {result.parts.filter((part) => part.correct).length} of {result.parts.length} parts right).
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() =>
              setResult(plugin.score(question.interaction, response, points, question.scoring ?? "PARTIAL"))
            }
          >
            Check my answer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
