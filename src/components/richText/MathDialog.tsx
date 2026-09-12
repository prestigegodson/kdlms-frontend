import { useRef, useState } from "react";
import { renderMathHtml } from "@/components/richText/katexHtml";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface MathDialogProps {
  open: boolean;
  /** The expression being edited, or `""` when inserting a new one. */
  initialLatex: string;
  onSubmit: (latex: string) => void;
  onClose: () => void;
}

/** Common symbols a teacher without LaTeX fluency reaches for most - each inserts at the caret rather than replacing the field. */
const SHORTCUTS: Array<{ label: string; insert: string }> = [
  { label: "Fraction", insert: "\\frac{a}{b}" },
  { label: "Power", insert: "x^{2}" },
  { label: "Root", insert: "\\sqrt{x}" },
  { label: "×", insert: "\\times" },
  { label: "÷", insert: "\\div" },
  { label: "≤", insert: "\\leq" },
  { label: "≥", insert: "\\geq" },
  { label: "π", insert: "\\pi" },
  { label: "θ", insert: "\\theta" },
  { label: "Σ", insert: "\\sum" },
];

/**
 * The toolbar's ∑ button opens this - a LaTeX input with a live KaTeX
 * preview and a shortcut row, so a teacher who doesn't know LaTeX syntax
 * can still build a fraction or a power. Clicking an existing expression in
 * the editor (via `InlineMath`'s `onClick`) reopens this same dialog
 * pre-filled, so editing and inserting are the same flow.
 */
export function MathDialog({ open, initialLatex, onSubmit, onClose }: MathDialogProps) {
  const [latex, setLatex] = useState(initialLatex);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resets the field to whatever expression is being edited (or blank, for
  // a fresh insert) exactly when the dialog transitions to open - done
  // during render rather than as a synchronous setState in an effect, the
  // same pattern `useObjectUrl`'s `lastKey` tracking uses.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLatex(initialLatex);
    }
  }

  if (!open) {
    return null;
  }

  const preview = latex.trim() === "" ? null : renderMathHtml(latex);

  function insertAtCaret(snippet: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? latex.length;
    const end = input?.selectionEnd ?? latex.length;
    const next = latex.slice(0, start) + snippet + latex.slice(end);
    setLatex(next);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  function handleSubmit() {
    const trimmed = latex.trim();
    if (trimmed === "") {
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <Modal open={open} onClose={onClose} title="Insert maths" size="md">
      <div className="space-y-4">
        <FormField label="LaTeX expression" htmlFor="math-dialog-latex">
          <Input
            id="math-dialog-latex"
            ref={inputRef}
            value={latex}
            onChange={(event) => setLatex(event.target.value)}
            placeholder="e.g. \frac{1}{2}"
            autoFocus
          />
        </FormField>

        <div className="flex flex-wrap gap-1.5">
          {SHORTCUTS.map((shortcut) => (
            <Button
              key={shortcut.label}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => insertAtCaret(shortcut.insert)}
            >
              {shortcut.label}
            </Button>
          ))}
        </div>

        <div className="min-h-16 rounded-control border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="mb-1 block text-xs font-medium text-slate-500">Preview</span>
          {preview === null ? (
            <span className="text-sm text-slate-400">Nothing to preview yet</span>
          ) : (
            // Safe per katexHtml.ts's doc comment: KaTeX's own output for this expression, rendered with trust: false.
            <span dangerouslySetInnerHTML={{ __html: preview }} />
          )}
        </div>
        {preview !== null && preview.includes("katex-error") && (
          <Alert variant="error">This doesn't look like valid LaTeX - check the syntax above.</Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={latex.trim() === ""}>
            Insert
          </Button>
        </div>
      </div>
    </Modal>
  );
}
