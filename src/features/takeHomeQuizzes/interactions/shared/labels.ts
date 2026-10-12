/** Visible text of a sanitized rich-text label - for announcements and plain-text pickers. */
export function plainText(html: string): string {
  const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

/** A label's text, or `fallback` when it has none (an image- or maths-only label). */
export function describeLabel(html: string, fallback: string): string {
  return plainText(html) || fallback;
}

/** An empty single-line rich-text label. */
export const BLANK_LABEL = "<p></p>";
