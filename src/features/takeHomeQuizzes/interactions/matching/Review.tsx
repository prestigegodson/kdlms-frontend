import { Check, X } from "lucide-react";
import { RichContent } from "@/components/richText/RichContent";
import type { PartFeedback, RenderImage } from "../types";
import type { MatchingConfig, MatchingResponse } from "./types";
import { useParticipantNoun } from "@/components/ParticipantNoun";

interface MatchingReviewProps {
  config: MatchingConfig;
  response: MatchingResponse | null;
  parts: PartFeedback[];
  renderImage?: RenderImage;
  perspective: "staff" | "self";
}

/** Each prompt with the student's answer and, when it differs, the correct one - marked from the frozen feedback. */
export function MatchingReview({ config, parts, renderImage, perspective }: MatchingReviewProps) {
  const { Singular } = useParticipantNoun();
  const rights = new Map(config.rights.map((right) => [right.id, right.html]));
  const byLeft = new Map(parts.map((part) => [part.partId, part]));
  const answerLabel = perspective === "self" ? "Your answer" : `${Singular}'s answer`;

  return (
    <ul className="space-y-1 text-sm">
      {config.lefts.map((left) => {
        const part = byLeft.get(left.id);
        const correct = part?.correct === true;
        const given = part?.givenRef ? rights.get(part.givenRef) : undefined;
        const expected = left.rightId ? rights.get(left.rightId) : undefined;
        return (
          <li
            key={left.id}
            className={`grid gap-1 rounded-control border px-3 py-1.5 sm:grid-cols-[auto_1fr_1fr] sm:items-start sm:gap-3 ${
              correct ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
            }`}
          >
            {correct ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Correct" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Wrong" />
            )}
            <RichContent html={left.html} renderImage={renderImage} className="min-w-0 font-medium" />
            <div className="min-w-0 space-y-0.5">
              <div>
                <span className="text-slate-500">{answerLabel}: </span>
                {given ? (
                  <RichContent html={given} renderImage={renderImage} className="inline-block" />
                ) : (
                  <span className="text-slate-400">No answer</span>
                )}
              </div>
              {!correct && expected && (
                <div>
                  <span className="text-slate-500">Correct: </span>
                  <RichContent html={expected} renderImage={renderImage} className="inline-block" />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
