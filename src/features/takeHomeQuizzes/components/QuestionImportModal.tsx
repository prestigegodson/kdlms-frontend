import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  questionImportErrors,
  type QuestionCommand,
  type QuestionImportRowError,
  type QuestionTemplateFormat,
} from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { downloadBlob } from "@/utils/download";

/**
 * The two calls a bulk question upload needs - the school and creator editors pass their own
 * endpoints (the `AiGenerateSheet` `generate`-callback precedent), so one modal serves both.
 */
export interface QuestionImporter {
  importFile: (file: File) => Promise<QuestionCommand[]>;
  fetchTemplate: (format: QuestionTemplateFormat) => Promise<Blob>;
}

interface QuestionImportModalProps {
  open: boolean;
  onClose: () => void;
  importer: QuestionImporter;
  /** Hands the parsed, unsaved questions to the editor - the author saves them with the quiz. */
  onImport: (questions: QuestionCommand[]) => void;
}

type ImportState =
  | { kind: "idle" }
  | { kind: "parsed"; fileName: string; questions: QuestionCommand[] }
  | { kind: "rejected"; fileName: string; message: string; errors: QuestionImportRowError[] };

/**
 * Upload a csv/xlsx/xls question file: the server parses it (saving nothing) and either returns the
 * questions, which are appended to the editor for review, or lists every problem by row so the
 * author can fix the file and upload it again.
 */
export function QuestionImportModal({ open, onClose, importer, onImport }: QuestionImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ kind: "idle" });
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<QuestionTemplateFormat | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  function close() {
    setState({ kind: "idle" });
    setTemplateError(null);
    onClose();
  }

  async function downloadTemplate(format: QuestionTemplateFormat) {
    setDownloading(format);
    setTemplateError(null);
    try {
      downloadBlob(await importer.fetchTemplate(format), `quiz-questions-template.${format}`);
    } catch (error) {
      setTemplateError(getErrorMessage(error, "Failed to download the template."));
    } finally {
      setDownloading(null);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const questions = await importer.importFile(file);
      setState({ kind: "parsed", fileName: file.name, questions });
    } catch (error) {
      setState({
        kind: "rejected",
        fileName: file.name,
        message: getErrorMessage(error, "Failed to read this file."),
        errors: questionImportErrors(error),
      });
    } finally {
      setUploading(false);
    }
  }

  function addToQuiz() {
    if (state.kind !== "parsed") return;
    onImport(state.questions);
    close();
  }

  const rowErrors = state.kind === "rejected" ? state.errors.filter((error) => error.row !== null) : [];

  return (
    <Modal open={open} onClose={close} title="Import questions from a file" size="xl">
      <div className="space-y-5">
        <section className="space-y-2">
          <p className="text-sm text-slate-600">
            Write your questions in a spreadsheet, one per row, using the template. Types are{" "}
            <span className="font-medium text-slate-800">single</span>,{" "}
            <span className="font-medium text-slate-800">multiple</span> and{" "}
            <span className="font-medium text-slate-800">fill_in_the_gap</span>. The correct answer is the option
            letter (e.g. <span className="font-mono">B</span>, or <span className="font-mono">A|C</span> for
            multiple), or the answer itself for fill in the gap.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={downloading === "xlsx"}
              onClick={() => void downloadTemplate("xlsx")}
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Template (.xlsx)
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={downloading === "csv"}
              onClick={() => void downloadTemplate("csv")}
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Template (.csv)
            </Button>
          </div>
          {templateError && <Alert variant="error">{templateError}</Alert>}
        </section>

        <section className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label="Question file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="primary" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {state.kind === "idle" ? "Choose file" : "Choose another file"}
            </Button>
            <span className="text-xs text-slate-500">.csv, .xlsx or .xls, up to 200 questions.</span>
          </div>
        </section>

        {state.kind === "parsed" && (
          <Alert variant="success" title={`${state.questions.length} ${state.questions.length === 1 ? "question" : "questions"} ready`}>
            <span className="inline-flex items-center gap-1">
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              {state.fileName}
            </span>{" "}
            - they'll be added to the end of this quiz. Review them, then click Save; nothing is saved until you do.
          </Alert>
        )}

        {state.kind === "rejected" && (
          <div className="space-y-3">
            <Alert variant="error" title={`${state.fileName} couldn't be imported`}>
              {state.message}
            </Alert>
            {rowErrors.length > 0 && (
              <div className="max-h-72 overflow-y-auto overscroll-contain rounded-panel border border-slate-200">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell numeric>Row</TableHeaderCell>
                      <TableHeaderCell>Column</TableHeaderCell>
                      <TableHeaderCell>Problem</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rowErrors.map((error, index) => (
                      <TableRow key={`${error.row}-${error.column}-${index}`}>
                        <TableCell numeric label="Row">
                          {error.row}
                        </TableCell>
                        <TableCell label="Column" className="font-mono text-xs">
                          {error.column ?? "-"}
                        </TableCell>
                        <TableCell label="Problem">{error.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={state.kind !== "parsed"} onClick={addToQuiz}>
            Add to quiz
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * A bare "download the template" action for a quiz that can't take an import yet (still unsaved),
 * so an author can start writing questions in a spreadsheet straight away.
 */
export function QuestionTemplateDownload({ fetchTemplate }: Pick<QuestionImporter, "fetchTemplate">) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      downloadBlob(await fetchTemplate("xlsx"), "quiz-questions-template.xlsx");
    } catch (downloadError) {
      setError(getErrorMessage(downloadError, "Failed to download the template."));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" size="sm" loading={downloading} onClick={() => void download()}>
        <Download className="h-4 w-4" aria-hidden="true" /> Download question template (.xlsx)
      </Button>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
