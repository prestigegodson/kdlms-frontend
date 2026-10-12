import { Check, X } from "lucide-react";
import { RichContent } from "@/components/richText/RichContent";
import type { PartFeedback, RenderImage } from "../types";
import type { SequenceConfig, SequenceResponse } from "./types";

interface SequenceReviewProps {
  config: SequenceConfig;
  response: SequenceResponse | null;
  parts: PartFeedback[];
  renderImage?: RenderImage;
  perspective: "staff" | "self";
}

/**
 * The student's order beside the correct one (with captions). Each of the student's items is marked
 * by whether the item they put after it really comes next - the pairs the score counts - and their
 * last item by whether it really comes last.
 */
export function SequenceReview({ config, response, parts, renderImage, perspective }: SequenceReviewProps) {
  const byId = new Map(config.items.map((item) => [item.id, item]));
  const nextIsRight = new Map(parts.map((part) => [part.partId, part.correct]));
  const known = new Set(byId.keys());
  const given = [...new Set((response?.order ?? []).filter((id) => known.has(id)))];

  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <p className="mb-1 text-slate-500">{perspective === "self" ? "Your order" : "Student's order"}</p>
        {given.length === 0 ? (
          <p className="text-slate-400">No answer</p>
        ) : (
          <ol className="space-y-1">
            {given.map((id, index) => {
              const last = index === given.length - 1;
              // Only the correct order's last item has no pair of its own: it's right exactly when nothing follows it.
              const right = nextIsRight.has(id) ? nextIsRight.get(id) === true : last;
              return (
                <li
                  key={id}
                  className={`flex items-start gap-2 rounded-control border px-3 py-1.5 ${
                    right ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
                  }`}
                >
                  <span className="w-5 shrink-0 text-slate-500">{index + 1}.</span>
                  <RichContent html={byId.get(id)?.html ?? ""} renderImage={renderImage} className="min-w-0 flex-1" />
                  {right ? (
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                      aria-label={last ? "Correctly placed last" : "Next item correct"}
                    />
                  ) : (
                    <X
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                      aria-label={last ? "Wrongly placed last" : "Next item wrong"}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div>
        <p className="mb-1 text-slate-500">Correct order</p>
        <ol className="space-y-1">
          {config.items.map((item, index) => (
            <li key={item.id} className="flex items-start gap-2 rounded-control border border-slate-200 px-3 py-1.5">
              <span className="w-5 shrink-0 text-slate-500">{index + 1}.</span>
              <RichContent html={item.html} renderImage={renderImage} className="min-w-0 flex-1" />
              {item.caption && <span className="shrink-0 text-xs font-medium text-slate-500">{item.caption}</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
