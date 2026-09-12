/**
 * Client-side twin of the backend `QuizRichText.isBlank` - `true` when
 * `html` carries no visible text and no maths/image content. A bare
 * `"<p></p>"` (TipTap's empty-document shape) is blank by this check even
 * though it is not blank by `String.prototype.trim`. Used only for
 * in-progress authoring affordances (e.g. "this question looks empty") -
 * the server, via `QuizRichText.isBlank`, is the actual authority on save.
 */
export function richTextIsBlank(html: string | null | undefined): boolean {
  if (!html) {
    return true;
  }
  const body = new DOMParser().parseFromString(html, "text/html").body;
  if ((body.textContent ?? "").trim() !== "") {
    return false;
  }
  return body.querySelector('img[data-file-id], span[data-latex]') === null;
}
