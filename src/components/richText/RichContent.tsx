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
 * Read-only counterpart to `RichTextField` - renders the tiny vocabulary a
 * backend sanitizer allows (`takehomequiz.domain.QuizRichText`'s
 * `p`/`ul`/`ol`/`li`/`strong`/`em`/`u`/`s`/`code`/`sub`/`sup`/`br`, an
 * inline-math span, and an image referenced by `data-file-id`; Phase 16G's
 * `lessonnote.domain.LessonNoteRichText` additionally allows
 * `h2`/`h3`/`h4`, `blockquote`, `hr`, a table, and a block-math `div`),
 * built by walking a `DOMParser` tree into explicit React elements rather
 * than trusting the string. The only `dangerouslySetInnerHTML` here is
 * KaTeX's own render output for one `data-latex` value at a time (see
 * `katexHtml.ts`'s safety argument) - every other node is either an
 * allow-listed React element or is dropped.
 * <p>
 * Deliberately imports nothing from `@tiptap/*`: the anonymous take-home
 * quiz page and the guardian ward lesson-note view both render through this
 * component and must not pull ProseMirror into their bundle (see the
 * take-home quiz plan's poor-connectivity note) - `RichTextField`, the
 * authoring editor, is the only place that dependency is paid.
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
    case "H2":
      return <h2 className="text-lg font-semibold text-slate-900">{children()}</h2>;
    case "H3":
      return <h3 className="text-base font-semibold text-slate-900">{children()}</h3>;
    case "H4":
      return <h4 className="text-sm font-semibold text-slate-900">{children()}</h4>;
    case "BLOCKQUOTE":
      return <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-600">{children()}</blockquote>;
    case "HR":
      return <hr className="border-slate-200" />;
    case "TABLE":
      return (
        <div className="overflow-x-auto">
          <table className="border-collapse border border-slate-300">{children()}</table>
        </div>
      );
    case "THEAD":
      return <thead>{children()}</thead>;
    case "TBODY":
      return <tbody>{children()}</tbody>;
    case "TR":
      return <tr>{children()}</tr>;
    case "TH":
      return (
        <th
          className="border border-slate-300 bg-slate-50 px-2 py-1 text-left font-medium"
          colSpan={attrNumber(element, "colspan")}
          rowSpan={attrNumber(element, "rowspan")}
        >
          {children()}
        </th>
      );
    case "TD":
      return (
        <td
          className="border border-slate-300 px-2 py-1 align-top"
          colSpan={attrNumber(element, "colspan")}
          rowSpan={attrNumber(element, "rowspan")}
        >
          {children()}
        </td>
      );
    case "SPAN":
      return renderMathSpan(element);
    case "DIV":
      return renderBlockMathDiv(element);
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

/** The block-math counterpart to {@link renderMathSpan} - a `<div data-type="block-math" data-latex="...">`, KaTeX's own centred layout (`displayMode: true`). */
function renderBlockMathDiv(element: Element): ReactNode {
  if (element.getAttribute("data-type") !== "block-math" || !element.hasAttribute("data-latex")) {
    return renderChildren(element);
  }
  const latex = element.getAttribute("data-latex") ?? "";
  const rendered = renderMathHtml(latex, true);
  if (rendered === null) {
    return <div className="my-1">{latex}</div>;
  }
  // Safe per katexHtml.ts's doc comment: KaTeX's own output for this one expression, rendered with trust: false.
  return <div className="my-1" dangerouslySetInnerHTML={{ __html: rendered }} />;
}

/** `colspan`/`rowspan` as a React `colSpan`/`rowSpan` number - `undefined` (not rendered) rather than `NaN` for a missing or malformed attribute. */
function attrNumber(element: Element, name: string): number | undefined {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function renderImageElement(element: Element, renderImage?: RichContentProps["renderImage"]): ReactNode {
  const fileId = element.getAttribute("data-file-id");
  if (!fileId || !renderImage) {
    return null;
  }
  return renderImage(fileId, element.getAttribute("alt") ?? "");
}
