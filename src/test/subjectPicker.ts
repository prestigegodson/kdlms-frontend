import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** Opens a `SubjectTargetSelect` by its field label and returns its listbox. */
export async function openSubjectPicker(user: UserEvent, label = "Subject"): Promise<HTMLElement> {
  await user.click(await screen.findByLabelText(label));
  return screen.findByRole("listbox", { name: "Subjects" });
}

/** Picks the named subject (or selectable group) from a `SubjectTargetSelect`. */
export async function pickSubject(user: UserEvent, name: string, label = "Subject"): Promise<void> {
  const listbox = await openSubjectPicker(user, label);
  await user.click(await within(listbox).findByRole("option", { name }));
}
