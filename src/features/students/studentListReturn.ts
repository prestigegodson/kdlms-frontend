const STORAGE_KEY = "kdlms.studentList.search";
const LIST_PATH = "/school/students";

/**
 * Remembers the Pupils list's current query string (its filters), so the pupil
 * detail page's back link returns to the list exactly as it was filtered - even
 * after a detour through Result history, which router state wouldn't survive.
 */
export function rememberStudentListSearch(search: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, search);
  } catch {
    // Storage unavailable - back falls through to the unfiltered list.
  }
}

/** The Pupils list URL with its last-remembered filters, or the bare list. */
export function studentListHref(): string {
  try {
    const search = sessionStorage.getItem(STORAGE_KEY);
    return search ? `${LIST_PATH}?${search}` : LIST_PATH;
  } catch {
    return LIST_PATH;
  }
}
