const STORAGE_KEY = "kdlms.classList.search";
const LIST_PATH = "/school/academics/classrooms";

/**
 * Remembers the Classrooms list's current query string (its filters), so the classroom
 * detail page's back link returns to the list exactly as it was filtered - even
 * after a detour through Attendance or Assessments, which router state wouldn't survive.
 */
export function rememberClassListSearch(search: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, search);
  } catch {
    // Storage unavailable - back falls through to the unfiltered list.
  }
}

/** The Classrooms list URL with its last-remembered filters, or the bare list. */
export function classListHref(): string {
  try {
    const search = sessionStorage.getItem(STORAGE_KEY);
    return search ? `${LIST_PATH}?${search}` : LIST_PATH;
  } catch {
    return LIST_PATH;
  }
}
