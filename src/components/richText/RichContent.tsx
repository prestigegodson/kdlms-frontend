import { Fragment, useMemo, type ReactNode } from "react";
import { renderMathHtml } from "@/components/richText/katexHtml";

export interface RichContentProps {
  /** Sanitized HTML from a question prompt or option label - see the backend `takehomequiz.domain.QuizRichText` sanitizer, whose vocabulary this renderer mirrors exactly. */
  html: string;
  /** Resolves an embedded image's `data-file-id` to a renderable element - omit for a caller that has no need to render images here, in which case any `<img>` is silently dropped. */
  renderImage?: (fileId: string, alt: string) => ReactNode;
  className?: string;
}

/**
 * Read-only counterpart to `RichTextField` - renders the identical tiny
 * vocabulary the backend `QuizRichText` sanitizer allows (`p`/`ul`/`ol`/`li`,
 * `strong`/`em`/`u`/`s`/`code`/`sub`/`sup`/`br`, an inline-math span, and an
 * image referenced by `data-file-id`), built by walking a `DOMParser` tree
 * into explicit React elements rather than trusting the string. The only
 * `dangerouslySetInnerHTML` here is KaTeX's own render output for one
 * `data-latex` value at a time (see `katexHtml.ts`'s safety argument) -
 * every other node is either an allow-listed React element or is dropped.
 * <p>
 * Deliberately imports nothing from `@tiptap/*`: the anonymous take-home
 * quiz page renders through this component and must not pull ProseMirror
 * into its bundle (see the take-home quiz plan's poor-connectivity note) -
 * `RichTextField`, the authoring editor, is the only place that dependency
 * is paid.
 */
export function RichContent({ html, renderImage, className }: RichContentProps) {
  const body = useMemo(() => new DOMParser().parseFromString(html, "text/html").body, [html]);
  return <div className={className}>{renderChildren(body, renderImage)}</div>;
}

function renderChildren(parent: Node, renderImage?: RichContentProps["renderImage"]): ReactNode {
  return Array.from(parent.childNodes).map((node, index) => (
    <Fragment key={index}>{renderNode(node, renderImage)}</Fragment>
  ));
}

function renderNode(node: Node, renderImage?: RichContentProps["renderImage"]): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const element = node as Element;
  const children = () => renderChildren(element, renderImage);

  switch (element.tagName) {
    case "BR":
      return <br />;
    case "P":
      return <p>{children()}</p>;
    case "UL":
      return <ul className="list-disc pl-5">{children()}</ul>;
    case "OL":
      return <ol className="list-decimal pl-5">{children()}</ol>;
    case "LI":
      return <li>{children()}</li>;
    case "STRONG":
      return <strong>{children()}</strong>;
    case "EM":
      return <em>{children()}</em>;
    case "U":
      return <u>{children()}</u>;
    case "S":
      return <s>{children()}</s>;
    case "CODE":
      return <code>{children()}</code>;
    case "SUB":
      return <sub>{children()}</sub>;
    case "SUP":
      return <sup>{children()}</sup>;
    case "SPAN":
      return renderMathSpan(element);
    case "IMG":
      return renderImageElement(element, renderImage);
    case "SCRIPT":
    case "STYLE":
      // Dropped whole, content included - unlike the generic default below,
      // these two hold raw, unparsed text (JS/CSS source) rather than
      // further markup, so "unwrap and keep children" would leak that
      // source as visible text instead of removing it.
      return null;
    default:
      // Not in the vocabulary (shouldn't happen against sanitized content,
      // but a defensive default matters on the codebase's most exposed
      // surface) - drop the tag, keep its children, mirroring the backend
      // sanitizer's own "unwrap" behaviour for an unrecognised shape.
      return children();
  }
}

function renderMathSpan(element: Element): ReactNode {
  if (element.getAttribute("data-type") !== "inline-math" || !element.hasAttribute("data-latex")) {
    return renderChildren(element);
  }
  const latex = element.getAttribute("data-latex") ?? "";
  const rendered = renderMathHtml(latex);
  if (rendered === null) {
    return latex;
  }
  // Safe per katexHtml.ts's doc comment: KaTeX's own output for this one
  // expression, rendered with trust: false.
  return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
}

function renderImageElement(element: Element, renderImage?: RichContentProps["renderImage"]): ReactNode {
  const fileId = element.getAttribute("data-file-id");
  if (!fileId || !renderImage) {
    return null;
  }
  return renderImage(fileId, element.getAttribute("alt") ?? "");
}
