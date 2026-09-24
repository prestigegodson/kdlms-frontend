import type { Page } from "@/api/types";

/**
 * Slices an already-loaded list into the same `Page<T>` shape a backend endpoint returns, so a
 * page whose data comes whole from a shared store (the student portal's terms, a ward's terms) can
 * reuse `Pagination` unchanged. `pageIndex` is 0-indexed and clamped into range, so a stale or
 * hand-edited `?page=` never renders an empty page.
 */
export function paginate<T>(items: T[], pageIndex: number, size: number): Page<T> {
  const totalPages = Math.ceil(items.length / size);
  const number = Math.min(Math.max(0, Math.trunc(pageIndex) || 0), Math.max(totalPages - 1, 0));
  return {
    content: items.slice(number * size, (number + 1) * size),
    totalElements: items.length,
    totalPages,
    number,
    size,
  };
}
