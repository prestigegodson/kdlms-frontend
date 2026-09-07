import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  exportTakeHomeQuizLinks,
  getTakeHomeQuizLinks,
  issueMissingTakeHomeQuizLinks,
  reissueTakeHomeQuizLink,
  type StudentLinkView,
} from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { downloadBlob } from "@/utils/download";
import { Copy, Download } from "lucide-react";

interface StudentLinksPanelProps {
  quizId: string;
  /** Bump to force a refetch - e.g. right after a publish action in the parent page. */
  refreshToken: number;
}

/**
 * A quiz's per-student link state and management actions (Phase 20C) - copy
 * one link, copy every link, download the CSV export, reissue a student's
 * link, and issue links for any roster student who doesn't have one yet
 * (a late joiner). `Table` with `TableCell label` props so it stacks below
 * `md`, per the style guide.
 */
export function StudentLinksPanel({ quizId, refreshToken }: StudentLinksPanelProps) {
  const [links, setLinks] = useState<StudentLinkView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [reissueTarget, setReissueTarget] = useState<StudentLinkView | null>(null);
  const [issuingMissing, setIssuingMissing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(() => {
    getTakeHomeQuizLinks(quizId)
      .then(setLinks)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load links"));
  }, [quizId]);

  useEffect(() => {
    load();
  }, [load, refreshToken, reloadToken]);

  function copy(studentId: string, url: string) {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedStudentId(studentId);
      setTimeout(() => setCopiedStudentId((current) => (current === studentId ? null : current)), 1500);
    });
  }

  function copyAll() {
    if (!links) return;
    const text = links
      .filter((link) => link.url)
      .map((link) => `${link.fullName}: ${link.url}`)
      .join("\n");
    navigator.clipboard?.writeText(text);
  }

  async function download() {
    setDownloading(true);
    setActionError(null);
    try {
      const blob = await exportTakeHomeQuizLinks(quizId);
      downloadBlob(blob, "take-home-quiz-links.csv");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to download the links");
    } finally {
      setDownloading(false);
    }
  }

  async function handleReissue() {
    if (!reissueTarget) return;
    await reissueTakeHomeQuizLink(quizId, reissueTarget.studentId);
    setReissueTarget(null);
    setReloadToken((token) => token + 1);
  }

  async function issueMissing() {
    setIssuingMissing(true);
    setActionError(null);
    try {
      await issueMissingTakeHomeQuizLinks(quizId);
      setReloadToken((token) => token + 1);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to issue the missing links");
    } finally {
      setIssuingMissing(false);
    }
  }

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }
  if (!links) {
    return null;
  }

  const missingCount = links.filter((link) => !link.url).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-medium text-slate-900">Student links</h2>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={copyAll}>
            <Copy className="h-4 w-4" aria-hidden="true" /> Copy all
          </Button>
          <Button type="button" variant="secondary" size="sm" loading={downloading} onClick={download}>
            <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
          </Button>
        </div>
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {missingCount > 0 && (
        <Alert variant="warning">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {missingCount} student{missingCount === 1 ? "" : "s"} on the roster {missingCount === 1 ? "has" : "have"}{" "}
              no link yet.
            </span>
            <Button type="button" variant="secondary" size="sm" loading={issuingMissing} onClick={issueMissing}>
              Issue links
            </Button>
          </div>
        </Alert>
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Student</TableHeaderCell>
            <TableHeaderCell>Admission No.</TableHeaderCell>
            <TableHeaderCell>Link</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {links.map((link) => (
            <TableRow key={link.studentId}>
              <TableCell label="Student">{link.fullName}</TableCell>
              <TableCell label="Admission No.">{link.admissionNumber}</TableCell>
              <TableCell label="Link">
                {link.url ? (
                  <span className="text-slate-500">Issued</span>
                ) : (
                  <span className="text-slate-400">No link yet</span>
                )}
              </TableCell>
              <TableCell label="Actions">
                <div className="flex gap-2">
                  {link.url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => copy(link.studentId, link.url!)}>
                      {copiedStudentId === link.studentId ? "Copied!" : "Copy"}
                    </Button>
                  )}
                  {link.url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setReissueTarget(link)}>
                      Reissue
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {reissueTarget && (
        <ConfirmDialog
          title="Reissue this student's link?"
          message={`The current link for ${reissueTarget.fullName} will stop working, and a new one will be emailed to their guardians.`}
          confirmLabel="Reissue"
          onConfirm={handleReissue}
          onClose={() => setReissueTarget(null)}
        />
      )}
    </div>
  );
}
