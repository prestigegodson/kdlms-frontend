import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  getWardTakeHomeQuiz,
  getWardTakeHomeQuizzes,
  listWardTerms,
  type WardTakeHomeQuizSummaryView,
  type WardTakeHomeQuizView,
  type WardTermView,
} from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { formatInstant } from "@/utils/date";
import { useWardStore } from "@/stores/wardStore";

/**
 * A ward's take-home quiz results for one term (Phase 20G) - deliberately gated on this module's
 * own `RESULTS_PUBLISHED` state, not `resultsPublished`/`midtermPublished` like `WardResultsPage`
 * is (CLAUDE.md's Domain Rules: a take-home quiz's own release must not be coupled to the
 * end-of-term result release). Flat single page, the `WardTimetablePage`/`WardLessonNotesPage`
 * shape - `WardSelector` and a plain term `Select` dock in one `StickySubHeader`, and a row's
 * detail (instructions, class name, when results were published) opens in a `Modal` rather than a
 * second route, since there's no per-question breakdown to show at v1.
 */
export function WardTakeHomeQuizzesPage() {
  const {
    wards,
    selectedWardId,
    status,
    errorMessage: wardsError,
    fetchIfNeeded,
    retry,
  } = useWardStore();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const [terms, setTerms] = useState<WardTermView[]>([]);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termId, setTermId] = useState("");

  // A ward change resets its term list + selection during render (the WardTimetablePage pattern)
  // rather than inside the effect below, which only fetches.
  const selectionKey = selectedWardId ?? "";
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setTerms([]);
    setTermsError(null);
    setTermId("");
  }

  useEffect(() => {
    if (!selectedWardId) return;
    listWardTerms(selectedWardId)
      .then((fetchedTerms) => {
        setTerms(fetchedTerms);
        const preferred = [...fetchedTerms]
          .filter((term) => term.currentSession)
          .sort((a, b) => b.termNumber - a.termNumber)[0];
        setTermId(preferred?.termId ?? fetchedTerms[0]?.termId ?? "");
      })
      .catch((error: unknown) =>
        setTermsError(error instanceof ApiError ? error.message : "Failed to load this ward's terms"),
      );
  }, [selectedWardId]);

  const [quizzes, setQuizzes] = useState<WardTakeHomeQuizSummaryView[] | null>(null);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);

  const [lastTermId, setLastTermId] = useState(termId);
  if (termId !== lastTermId) {
    setLastTermId(termId);
    setQuizzes(null);
    setQuizzesError(null);
  }

  useEffect(() => {
    if (!selectedWardId || !termId) return;
    getWardTakeHomeQuizzes(selectedWardId, termId)
      .then(setQuizzes)
      .catch((error: unknown) =>
        setQuizzesError(error instanceof ApiError ? error.message : "Failed to load this ward's take-home quizzes"),
      );
  }, [selectedWardId, termId]);

  const [detail, setDetail] = useState<WardTakeHomeQuizView | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  function openDetail(quizId: string) {
    if (!selectedWardId) return;
    setDetailError(null);
    getWardTakeHomeQuiz(selectedWardId, quizId)
      .then(setDetail)
      .catch((error: unknown) =>
        setDetailError(error instanceof ApiError ? error.message : "Failed to load this quiz's result"),
      );
  }

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Take-home quizzes" description="Your ward's completed take-home quiz results." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={wardsError ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && (
        <StickySubHeader>
          <WardSelector />
          <FormField label="Term" htmlFor="ward-take-home-quizzes-term" className="min-w-0 flex-1 lg:max-w-xs">
            <Select
              id="ward-take-home-quizzes-term"
              value={termId}
              onChange={(event) => setTermId(event.target.value)}
            >
              <option value="">Select a term…</option>
              {terms.map((term) => (
                <option key={term.termId} value={term.termId}>
                  {term.termName} · {term.sessionName}
                </option>
              ))}
            </Select>
          </FormField>
        </StickySubHeader>
      )}

      {termsError && <Alert variant="error">{termsError}</Alert>}
      {quizzesError && <Alert variant="error">{quizzesError}</Alert>}

      {hasWards && terms.length === 0 && !termsError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading terms…
        </div>
      )}

      {termId && quizzes === null && !quizzesError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading take-home quizzes…
        </div>
      )}

      {quizzes && quizzes.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No take-home quiz results yet"
          description="Results appear here once your school's teacher has published them."
        />
      )}

      {quizzes && quizzes.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Quiz</TableHeaderCell>
              <TableHeaderCell>Subject</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell numeric>Score</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quizzes.map((quiz) => (
              <TableRow key={quiz.id} onClick={() => openDetail(quiz.id)}>
                <TableCell label="Quiz">
                  <span className="font-medium text-slate-900">{quiz.title}</span>
                  {quiz.countsTowardMidterm && (
                    <Badge variant="brand" className="ml-2">
                      Counts toward midterm
                    </Badge>
                  )}
                </TableCell>
                <TableCell label="Subject">{quiz.subjectName}</TableCell>
                <TableCell label="Status">
                  <Badge variant={quiz.submitted ? "success" : "neutral"}>
                    {quiz.submitted ? "Submitted" : "Not submitted"}
                  </Badge>
                </TableCell>
                <TableCell label="Score" numeric>
                  {quiz.score === null ? "—" : `${quiz.score} / ${quiz.totalPoints}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail?.title} size="md">
        {detailError && <Alert variant="error">{detailError}</Alert>}
        {detail && (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Subject:</span> {detail.subjectName}
            </p>
            <p>
              <span className="font-medium text-slate-900">Class:</span> {detail.className}
            </p>
            {detail.instructions && (
              <p>
                <span className="font-medium text-slate-900">Instructions:</span> {detail.instructions}
              </p>
            )}
            <p>
              <span className="font-medium text-slate-900">Score:</span>{" "}
              {detail.score === null ? "Not submitted" : `${detail.score} / ${detail.totalPoints}`}
            </p>
            {detail.countsTowardMidterm && (
              <p className="text-slate-500">This quiz counts toward the midterm quiz score.</p>
            )}
            <p className="text-slate-500">Published {formatInstant(detail.resultsPublishedAt)}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
