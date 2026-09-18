/**
 * The `max-h-*` classes `QuestionCard` always applied to an embedded image, before Phase 35I moved
 * image rendering out to each transport via `renderImage` - kept in one place so the public and
 * portal transports (which build structurally different elements - a bare `<img>` vs. an
 * authenticated blob-fetching component) still size an image identically by `size`.
 */
export const QUIZ_IMAGE_SIZE_CLASS: Record<"prompt" | "option", string> = {
  prompt: "my-1 max-h-60 rounded-control border border-slate-200",
  option: "my-1 max-h-32 rounded-control border border-slate-200",
};
