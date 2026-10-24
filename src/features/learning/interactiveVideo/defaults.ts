import type {
  InteractiveItem,
  InteractiveItemContent,
  InteractiveItemType,
  InteractiveVideoDocument,
} from "@/api/learning";
import { isGraded } from "./engine";

/** The editor toolbar's item types, in toolbar order, with their labels. */
export const ITEM_TYPES: readonly { type: InteractiveItemType; label: string; hint: string }[] = [
  { type: "LABEL", label: "Label", hint: "A short caption on the video" },
  { type: "TEXT", label: "Text", hint: "Formatted text, maths and images" },
  { type: "IMAGE", label: "Image", hint: "A picture over the video" },
  { type: "SINGLE_CHOICE", label: "Single choice", hint: "One correct option" },
  { type: "MULTIPLE_CHOICE", label: "Multiple choice", hint: "One or more correct options" },
  { type: "TRUE_FALSE", label: "True / false", hint: "Is the statement true?" },
  { type: "FILL_BLANKS", label: "Fill in the blanks", hint: "Type the missing words" },
  { type: "FREE_TEXT", label: "Free text", hint: "Answer, then compare with a model answer" },
  { type: "LINK", label: "Link", hint: "Opens a web page" },
  { type: "NAV_HOTSPOT", label: "Hotspot", hint: "A clickable area that jumps in the video" },
  { type: "CROSSROADS", label: "Crossroads", hint: "Choices that jump to different parts" },
];

export function itemTypeLabel(type: InteractiveItemType): string {
  return ITEM_TYPES.find((entry) => entry.type === type)?.label ?? type;
}

/** The stage size a freshly dropped item gets, as a fraction of the stage. */
const DEFAULT_SIZE: Partial<Record<InteractiveItemType, { w: number; h: number }>> = {
  LABEL: { w: 0.3, h: 0.1 },
  LINK: { w: 0.25, h: 0.1 },
  IMAGE: { w: 0.3, h: 0.3 },
  NAV_HOTSPOT: { w: 0.2, h: 0.2 },
};

/** How long a freshly dropped item stays on screen. */
export const DEFAULT_ITEM_SECONDS = 5;

export const EMPTY_CONTENT: InteractiveItemContent = {
  html: null,
  text: null,
  fileId: null,
  alt: null,
  question: null,
  options: null,
  answer: null,
  caseSensitive: null,
  prompt: null,
  modelAnswer: null,
  url: null,
  targetSeconds: null,
  shape: null,
  choices: null,
};

/** A fresh client-side id for an item or option - the backend keeps any id that is unique and short. */
export function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultContent(type: InteractiveItemType): InteractiveItemContent {
  switch (type) {
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
      return {
        ...EMPTY_CONTENT,
        options: [
          { id: newItemId(), text: "", correct: true },
          { id: newItemId(), text: "", correct: false },
        ],
      };
    case "TRUE_FALSE":
      return { ...EMPTY_CONTENT, answer: true };
    case "FILL_BLANKS":
      return { ...EMPTY_CONTENT, caseSensitive: false };
    case "NAV_HOTSPOT":
      return { ...EMPTY_CONTENT, shape: "RECTANGLE" };
    case "CROSSROADS":
      return {
        ...EMPTY_CONTENT,
        choices: [
          { label: "", targetSeconds: null },
          { label: "", targetSeconds: null },
        ],
      };
    default:
      return EMPTY_CONTENT;
  }
}

/**
 * A new item of `type` dropped at `(x, y)` (0..1 of the stage, its top-left corner) at `start`
 * seconds. Questions and crossroads pause the video by default and show as a button - H5P's own
 * defaults; a hotspot is always a poster-style region.
 */
export function newItem(type: InteractiveItemType, start: number, x: number, y: number): InteractiveItem {
  const size = DEFAULT_SIZE[type] ?? { w: 0.4, h: 0.35 };
  const graded = isGraded(type);
  const asksSomething = graded || type === "FREE_TEXT" || type === "CROSSROADS";
  return {
    id: newItemId(),
    type,
    start,
    end: start + DEFAULT_ITEM_SECONDS,
    x: Math.min(Math.max(0, x), 1 - size.w),
    y: Math.min(Math.max(0, y), 1 - size.h),
    w: size.w,
    h: size.h,
    pause: asksSomething,
    displayAs: type === "NAV_HOTSPOT" || type === "LABEL" ? "POSTER" : "BUTTON",
    mandatory: "NONE",
    style: { buttonLabel: null, size: "M", background: null, transparent: false },
    goTo: null,
    adaptivity: null,
    feedback: graded ? { correct: null, wrong: null } : null,
    enableRetry: graded,
    enableSolution: graded,
    content: defaultContent(type),
  };
}

export function emptyDocument(): InteractiveVideoDocument {
  return { schemaVersion: 1, items: [] };
}

/** The title a button-style item shows: its own label, else the question/prompt, else the type. */
export function itemTitle(item: InteractiveItem): string {
  const c = item.content;
  const text = (item.style?.buttonLabel ?? c.question ?? c.prompt ?? c.text ?? c.alt)?.trim();
  if (text) {
    return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  }
  return itemTypeLabel(item.type);
}
