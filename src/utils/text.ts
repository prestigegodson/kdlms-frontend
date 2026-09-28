/**
 * `title`'s possessive form - "Principal's", "Head of Nursery's". A title
 * already ending in "s" only gets a trailing apostrophe ("Staff'"), the
 * standard English rule. Mirrors the backend's identical helper
 * (`reporting.domain.TemplateRenderer#possessive`) so the printed report and
 * the on-screen remark headings can never read differently for the same
 * title.
 */
export function possessive(title: string): string {
  if (!title) return "Principal's";
  return title.endsWith("s") ? `${title}'` : `${title}'s`;
}
