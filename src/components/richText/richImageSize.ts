/**
 * The rich-text editor's own image size (`QuizImageNodeView`) - every reader of the same HTML
 * renders an embedded image at this size too, so what an author sees is what a reader sees. Sizing
 * only: each renderer keeps its own margin/border (the editor's border tracks selection).
 */
export const RICH_IMAGE_SIZE_CLASS = "inline-block max-h-32 max-w-full";
