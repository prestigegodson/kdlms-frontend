import { Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { findElementLocation } from "@/features/reporting/components/designer/layoutOps";
import { REPORT_TOKENS } from "@/features/reporting/components/reportBlocks";
import type { LayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";

function groupByPrefix(tokens: typeof REPORT_TOKENS): Array<[string, typeof REPORT_TOKENS]> {
  const groups = new Map<string, typeof REPORT_TOKENS>();
  for (const token of tokens) {
    const prefix = token.key.split(".")[0];
    const group = groups.get(prefix) ?? [];
    group.push(token);
    groups.set(prefix, group);
  }
  return Array.from(groups.entries());
}

const GROUP_LABELS: Record<string, string> = {
  school: "School",
  student: "Student",
  class: "Class / level",
  level: "Class / level",
  session: "Session / term",
  term: "Session / term",
  nextTerm: "Session / term",
  result: "Result",
  attendance: "Attendance",
  teacher: "Signatures",
  principal: "Signatures",
  remark: "Remarks",
};

/**
 * Renders `REPORT_TOKENS` for click-to-insert into the selected TEXT
 * element - this registry existed in the old GrapesJS designer too, but was
 * never actually rendered anywhere (a dead export a system admin had to
 * know to type `{{...}}` from memory). Falls back to copy-to-clipboard when
 * nothing selectable is selected.
 */
export function TokenPanel({ editor }: { editor: LayoutEditor }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const groups = useMemo(() => groupByPrefix(REPORT_TOKENS), []);

  const selectedText =
    editor.selection?.type === "element" ? findElementLocation(editor.layout, editor.selection.elementId) : undefined;
  const canInsert = selectedText?.element.type === "TEXT";

  function handleTokenClick(key: string) {
    const placeholder = `{{${key}}}`;
    if (canInsert && selectedText && selectedText.element.type === "TEXT") {
      editor.updateElement(selectedText.element.id, { text: `${selectedText.element.text}${placeholder}` });
    } else {
      navigator.clipboard?.writeText(placeholder).then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
      });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {canInsert ? "Click a token to insert it into the selected text." : "Select a Text element to insert directly, or click to copy."}
      </p>
      {groups.map(([prefix, tokens]) => (
        <div key={prefix}>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {GROUP_LABELS[prefix] ?? prefix}
          </h4>
          <div className="space-y-1">
            {tokens.map((token) => (
              <button
                key={token.key}
                type="button"
                onClick={() => handleTokenClick(token.key)}
                title={token.description}
                className="flex w-full items-center justify-between gap-2 rounded-control border border-slate-200 bg-white px-2 py-1 text-left text-xs hover:border-brand-400 hover:bg-brand-50/40"
              >
                <code className="text-slate-700">{`{{${token.key}}}`}</code>
                {!canInsert && <Copy className="h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />}
                {copiedKey === token.key && <span className="text-[10px] text-green-600">Copied</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
