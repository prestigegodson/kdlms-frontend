import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders one LaTeX expression to KaTeX's own HTML, or `null` if it can't be
 * parsed at all (vanishingly rare with `throwOnError: false`, which makes
 * KaTeX render its own `.katex-error` markup for a malformed expression
 * rather than throwing - this `catch` is a second line of defence only).
 * <p>
 * Extracted from `features/lessonNotes/components/MathText.tsx`, the first
 * caller, so there is one KaTeX safety argument in the codebase rather than
 * two: `trust: false` refuses `\href`/`\url`/`\htmlClass` and every other
 * HTML-emitting command, which is what makes it safe to hand the returned
 * string to `dangerouslySetInnerHTML` - the codebase's one sanctioned use of
 * it, now shared by `MathText` (lesson notes) and `RichContent`/the take-home
 * quiz maths dialog (question prompts/options). Neither `trust: false` nor
 * the "only ever a single expression's own output, never surrounding prose"
 * scoping should be relaxed without re-weighing this safety argument at both
 * call sites.
 */
/**
 * `displayMode` (Phase 16G) switches KaTeX's own centred/block layout for a
 * lesson note's displayed maths (`data-type="block-math"`) - `trust` stays
 * `false` either way.
 */
export function renderMathHtml(latex: string, displayMode = false): string | null {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      trust: false,
      strict: "ignore",
      displayMode,
    });
  } catch {
    return null;
  }
}
