import { FileUp } from "lucide-react";
import { useRef } from "react";
import { MAX_HTML_LENGTH } from "@/api/newsletters";
import { Textarea } from "@/components/ui/Textarea";
import { MERGE_TAGS } from "../newsletterContent";

interface HtmlSourcePaneProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Where the admin pastes (or loads from a file) the newsletter's full HTML, as exported from any
 * email builder. A plain monospace textarea on purpose - the HTML is the source of truth and is
 * sent as written (scripts and event handlers are stripped server-side). The merge-tag buttons
 * insert at the cursor.
 */
export function HtmlSourcePane({ value, onChange, disabled }: HtmlSourcePaneProps) {
  // The shared Textarea takes no ref, so the element is found through its wrapper.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function insert(tag: string) {
    const textarea = wrapperRef.current?.querySelector("textarea");
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + tag + value.slice(end));
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    onChange(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  }

  const tooLong = value.length > MAX_HTML_LENGTH;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">Insert:</span>
        {MERGE_TAGS.map(({ tag, label }) => (
          <button
            key={tag}
            type="button"
            disabled={disabled}
            onClick={() => insert(tag)}
            className="rounded-control border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 mobile:min-h-11"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="ml-auto inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50 mobile:min-h-11"
        >
          <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
          Load .html file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm,text/html"
          className="hidden"
          aria-label="HTML file"
          onChange={(event) => void loadFile(event.target.files?.[0])}
        />
      </div>
      <div ref={wrapperRef}>
        <Textarea
          id="newsletter-html"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          rows={22}
          placeholder="<html>…paste your newsletter HTML here…</html>"
          className="min-h-[360px] overscroll-contain font-mono text-xs mobile:text-sm"
          aria-invalid={tooLong || undefined}
        />
      </div>
      <p className={`text-right text-xs ${tooLong ? "text-red-600" : "text-slate-500"}`}>
        {value.length.toLocaleString()} / {MAX_HTML_LENGTH.toLocaleString()} characters
      </p>
    </div>
  );
}
