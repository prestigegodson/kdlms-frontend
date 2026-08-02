import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  type AcademicSessionView,
  addTerm,
  createSession,
  listSessions,
  listTerms,
  setCurrentSession,
  setCurrentTerm,
  type TermInput,
  type TermView,
  updateSession,
  updateTerm,
} from "@/api/sessions";
import { can } from "@/auth/permissions";
import { CalendarDays } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";
import { formatDateRange } from "@/utils/date";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; sessions: AcademicSessionView[] }
  | { kind: "error"; message: string };

const DEFAULT_TERM_NAMES = ["First Term", "Second Term", "Third Term"];

/**
 * Session and term setup for the caller's own school - a session starts with
 * just its first term (dates for the rest are often unknown yet); terms 2
 * and 3 are added later, and both the session and any term can be edited.
 */
export function SessionsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageAcademics(role);

  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSessionView | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function fetchSessions() {
    listSessions()
      .then((page) => setState({ kind: "loaded", sessions: page.content }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load sessions",
        }),
      );
  }

  useEffect(fetchSessions, []);

  function load() {
    setState({ kind: "loading" });
    fetchSessions();
  }

  async function makeCurrent(session: AcademicSessionView) {
    setActionError(null);
    try {
      await setCurrentSession(session.id);
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions & terms"
        description="The academic calendar: sessions and their terms."
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Add session</Button>}
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading sessions…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.sessions.length === 0 && (
        <EmptyState icon={CalendarDays} title="No sessions yet" description="Add a session to get started." />
      )}
      {state.kind === "loaded" && state.sessions.length > 0 && (
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Dates</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {state.sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  canManage={canManage}
                  expanded={expanded === session.id}
                  onToggleExpand={() => setExpanded(expanded === session.id ? null : session.id)}
                  onMakeCurrent={() => makeCurrent(session)}
                  onEdit={() => setEditingSession(session)}
                  onActionError={setActionError}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {createOpen && (
        <SessionFormModal
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {editingSession && (
        <SessionFormModal
          mode="edit"
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSaved={() => {
            setEditingSession(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface SessionRowProps {
  session: AcademicSessionView;
  canManage: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onMakeCurrent: () => void;
  onEdit: () => void;
  onActionError: (message: string) => void;
}

function SessionRow({
  session,
  canManage,
  expanded,
  onToggleExpand,
  onMakeCurrent,
  onEdit,
  onActionError,
}: SessionRowProps) {
  return (
    <>
      <TableRow>
        <TableCell label="Name" className="font-medium text-slate-900">
          <button type="button" className="text-left hover:underline" onClick={onToggleExpand}>
            {session.name}
          </button>
        </TableCell>
        <TableCell label="Dates">{formatDateRange(session.startDate, session.endDate)}</TableCell>
        <TableCell label="Status">
          <Badge variant={session.current ? "success" : "neutral"}>
            {session.current ? "Current" : "Not current"}
          </Badge>
        </TableCell>
        {canManage && (
          <TableCell label="Actions">
            <div className="flex flex-wrap items-center gap-3">
              {!session.current && (
                <button type="button" className="text-brand-500 hover:text-brand-600" onClick={onMakeCurrent}>
                  Make current
                </button>
              )}
              <button type="button" className="text-brand-500 hover:text-brand-600" onClick={onEdit}>
                Edit
              </button>
            </div>
          </TableCell>
        )}
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={canManage ? 4 : 3} className="bg-slate-50">
            <TermsPanel sessionId={session.id} canManage={canManage} onActionError={onActionError} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

interface TermsPanelProps {
  sessionId: string;
  canManage: boolean;
  onActionError: (message: string) => void;
}

function TermsPanel({ sessionId, canManage, onActionError }: TermsPanelProps) {
  const [terms, setTerms] = useState<TermView[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermView | null>(null);

  function fetchTerms() {
    listTerms(sessionId)
      .then(setTerms)
      .catch((error: unknown) => onActionError(error instanceof ApiError ? error.message : "Failed to load terms"));
  }

  useEffect(fetchTerms, [sessionId, onActionError]);

  async function makeCurrent(termId: string) {
    try {
      await setCurrentTerm(termId);
      fetchTerms();
    } catch (error) {
      onActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  if (terms === null) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
        <Spinner /> Loading terms…
      </div>
    );
  }

  return (
    <div className="py-2">
      <ul className="divide-y divide-slate-100">
        {terms.map((term) => (
          <li
            key={term.id}
            className="flex flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <span className="font-medium text-slate-900">{term.name}</span>{" "}
              <span className="text-slate-500">{formatDateRange(term.startDate, term.endDate)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={term.current ? "success" : "neutral"}>{term.current ? "Current" : "Not current"}</Badge>
              {canManage && !term.current && (
                <button
                  type="button"
                  className="text-brand-500 hover:text-brand-600"
                  onClick={() => makeCurrent(term.id)}
                >
                  Make current
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  className="text-brand-500 hover:text-brand-600"
                  onClick={() => setEditingTerm(term)}
                >
                  Edit
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canManage && terms.length < 3 && (
        <button type="button" className="mt-2 text-sm text-brand-500 hover:text-brand-600" onClick={() => setAddOpen(true)}>
          Add {DEFAULT_TERM_NAMES[terms.length]}
        </button>
      )}

      {addOpen && (
        <TermFormModal
          mode="add"
          sessionId={sessionId}
          nextTermNumber={terms.length + 1}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            fetchTerms();
          }}
        />
      )}
      {editingTerm && (
        <TermFormModal
          mode="edit"
          sessionId={sessionId}
          term={editingTerm}
          onClose={() => setEditingTerm(null)}
          onSaved={() => {
            setEditingTerm(null);
            fetchTerms();
          }}
        />
      )}
    </div>
  );
}

interface SessionFormModalProps {
  mode: "create" | "edit";
  session?: AcademicSessionView;
  onClose: () => void;
  onSaved: () => void;
}

/** Handles both creating a session (with its first term, or up to three) and editing an existing session's name/dates. */
function SessionFormModal({ mode, session, onClose, onSaved }: SessionFormModalProps) {
  const [name, setName] = useState(session?.name ?? "");
  const [startDate, setStartDate] = useState(session?.startDate ?? "");
  const [endDate, setEndDate] = useState(session?.endDate ?? "");
  const [terms, setTerms] = useState<TermInput[]>(
    mode === "create" ? [{ termNumber: 1, name: DEFAULT_TERM_NAMES[0], startDate: "", endDate: "" }] : [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateTermRow(index: number, patch: Partial<TermInput>) {
    setTerms((current) => current.map((term, i) => (i === index ? { ...term, ...patch } : term)));
  }

  function addTermRow() {
    setTerms((current) => [
      ...current,
      { termNumber: current.length + 1, name: DEFAULT_TERM_NAMES[current.length], startDate: "", endDate: "" },
    ]);
  }

  function removeLastTermRow() {
    setTerms((current) => current.slice(0, -1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "create") {
        await createSession({ name, startDate, endDate: endDate || null, terms });
      } else if (session) {
        await updateSession(session.id, { name, startDate, endDate: endDate || null });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={mode === "create" ? "Add session" : "Edit session"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Session name" htmlFor="session-name">
          <Input
            id="session-name"
            required
            placeholder="2026/2027"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Session start date" htmlFor="session-start-date">
            <DateInput id="session-start-date" required value={startDate} onChange={setStartDate} />
          </FormField>
          <FormField label="Session end date (optional)" htmlFor="session-end-date">
            <DateInput id="session-end-date" value={endDate} onChange={setEndDate} />
          </FormField>
        </div>

        {mode === "create" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Terms</p>
              <div className="flex items-center gap-3 text-sm">
                {terms.length > 1 && (
                  <button type="button" className="text-slate-500 hover:text-slate-700" onClick={removeLastTermRow}>
                    Remove {DEFAULT_TERM_NAMES[terms.length - 1]}
                  </button>
                )}
                {terms.length < 3 && (
                  <button type="button" className="text-brand-500 hover:text-brand-600" onClick={addTermRow}>
                    Add {DEFAULT_TERM_NAMES[terms.length]}
                  </button>
                )}
              </div>
            </div>
            {terms.map((term, index) => (
              <div key={term.termNumber} className="grid grid-cols-1 gap-3 rounded-control border border-slate-200 p-3 sm:grid-cols-3">
                <FormField label="Name" htmlFor={`term-${term.termNumber}-name`}>
                  <Input
                    id={`term-${term.termNumber}-name`}
                    required
                    value={term.name}
                    onChange={(event) => updateTermRow(index, { name: event.target.value })}
                  />
                </FormField>
                <FormField label="Start date" htmlFor={`term-${term.termNumber}-start`}>
                  <DateInput
                    id={`term-${term.termNumber}-start`}
                    required
                    value={term.startDate}
                    onChange={(value) => updateTermRow(index, { startDate: value })}
                  />
                </FormField>
                <FormField label="End date" htmlFor={`term-${term.termNumber}-end`}>
                  <DateInput
                    id={`term-${term.termNumber}-end`}
                    required
                    value={term.endDate}
                    onChange={(value) => updateTermRow(index, { endDate: value })}
                  />
                </FormField>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface TermFormModalProps {
  mode: "add" | "edit";
  sessionId: string;
  term?: TermView;
  nextTermNumber?: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Adds the next term to a session, or edits the name/dates of an existing one. */
function TermFormModal({ mode, sessionId, term, nextTermNumber, onClose, onSaved }: TermFormModalProps) {
  const [name, setName] = useState(term?.name ?? (nextTermNumber ? DEFAULT_TERM_NAMES[nextTermNumber - 1] : ""));
  const [startDate, setStartDate] = useState(term?.startDate ?? "");
  const [endDate, setEndDate] = useState(term?.endDate ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "add" && nextTermNumber) {
        await addTerm(sessionId, { termNumber: nextTermNumber, name, startDate, endDate });
      } else if (term) {
        await updateTerm(term.id, { name, startDate, endDate });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save term");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={mode === "add" ? "Add term" : "Edit term"}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Name" htmlFor="term-name">
          <Input id="term-name" required value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Start date" htmlFor="term-start-date">
            <DateInput id="term-start-date" required value={startDate} onChange={setStartDate} />
          </FormField>
          <FormField label="End date" htmlFor="term-end-date">
            <DateInput id="term-end-date" required value={endDate} onChange={setEndDate} />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
