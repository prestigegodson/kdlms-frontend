import { Check, X } from "lucide-react";
import { RichContent } from "@/components/richText/RichContent";
import type { PartFeedback, RenderImage } from "../types";
import type { CategorizeConfig, CategorizeResponse } from "./types";
import { useParticipantNoun } from "@/components/ParticipantNoun";

interface CategorizeReviewProps {
  config: CategorizeConfig;
  response: CategorizeResponse | null;
  parts: PartFeedback[];
  renderImage?: RenderImage;
  perspective: "staff" | "self";
}

/**
 * Each group with the items that belong in it, each marked from the frozen feedback - and, for a
 * wrong one, where the student put it instead.
 */
export function CategorizeReview({ config, parts, renderImage, perspective }: CategorizeReviewProps) {
  const { Singular } = useParticipantNoun();
  const groups = new Map(config.groups.map((group) => [group.id, group.html]));
  const byItem = new Map(parts.map((part) => [part.partId, part]));
  const placedLabel = perspective === "self" ? "You put it in" : `${Singular} put it in`;

  return (
    <div className="space-y-3 text-sm">
      {config.groups.map((group) => {
        const members = config.items.filter((item) => item.groupId === group.id);
        return (
          <section key={group.id}>
            <RichContent html={group.html} renderImage={renderImage} className="mb-1 font-semibold text-slate-800" />
            <ul className="space-y-1">
              {members.map((item) => {
                const part = byItem.get(item.id);
                const correct = part?.correct === true;
                const given = part?.givenRef ? groups.get(part.givenRef) : undefined;
                return (
                  <li
                    key={item.id}
                    className={`grid gap-1 rounded-control border px-3 py-1.5 sm:grid-cols-[auto_1fr_1fr] sm:items-start sm:gap-3 ${
                      correct ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
                    }`}
                  >
                    {correct ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Correct" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Wrong" />
                    )}
                    <RichContent html={item.html} renderImage={renderImage} className="min-w-0 font-medium" />
                    {!correct && (
                      <div className="min-w-0">
                        {given ? (
                          <>
                            <span className="text-slate-500">{placedLabel}: </span>
                            <RichContent html={given} renderImage={renderImage} className="inline-block" />
                          </>
                        ) : (
                          <span className="text-slate-400">Not sorted</span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
