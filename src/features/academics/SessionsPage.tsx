import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  type AcademicSessionView,
  createSession,
  listSessions,
  listTerms,
  setCurrentSession,
  setCurrentTerm,
  type TermInput,
  type TermView,
} from "@/api/sessions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { useAuthStore } from "@/stores/authStore";
import { formatDateRange } from "@/utils/date";

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; sessions: AcademicSessionView[] }
  | { kind: "error"; message: string };

const DEFAULT_TERM_NAMES = ["First Term", "Second Term", "Third Term"];

/** Session and term setup for the caller's own school - creating a session creates its three terms in one step. */
export function SessionsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN";

  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Sessions &amp; Terms</h1>
        {canManage && <Button onClick={() => setCreateOpen(true)}>Add session</Button>}
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading sessions…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.sessions.length === 0 && (
        <EmptyState title="No sessions yet" description="Add a session to get started." />
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
                  onActionError={setActionError}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {createOpen && (
        <CreateSessionModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
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
  onActionError: (message: string) => void;
}

function SessionRow({ session, canManage, expanded, onToggleExpand, onMakeCurrent, onActionError }: SessionRowProps) {
  return (
    <>
      <TableRow>
        <TableCell className="font-medium text-gray-900">
          <button type="button" className="text-left hover:underline" onClick={onToggleExpand}>
            {session.name}
          </button>
        </TableCell>
        <TableCell>{formatDateRange(session.startDate, session.endDate)}</TableCell>
        <TableCell>
          <Badge variant={session.current ? "success" : "neutral"}>
            {session.current ? "Current" : "Not current"}
          </Badge>
        </TableCell>
        {canManage && (
          <TableCell>
            {!session.current && (
              <button type="button" className="text-brand-600 hover:text-brand-700" onClick={onMakeCurrent}>
                Make current
              </button>
            )}
          </TableCell>
        )}
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={canManage ? 4 : 3} className="bg-gray-50">
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
      <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
        <Spinner /> Loading terms…
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 py-2">
      {terms.map((term) => (
        <li key={term.id} className="flex items-center justify-between py-2 text-sm">
          <div>
            <span className="font-medium text-gray-900">{term.name}</span>{" "}
            <span className="text-gray-500">{formatDateRange(term.startDate, term.endDate)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={term.current ? "success" : "neutral"}>{term.current ? "Current" : "Not current"}</Badge>
            {canManage && !term.current && (
              <button
                type="button"
                className="text-brand-600 hover:text-brand-700"
                onClick={() => makeCurrent(term.id)}
              >
                Make current
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

interface CreateSessionModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function CreateSessionModal({ onClose, onSaved }: CreateSessionModalProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [terms, setTerms] = useState<TermInput[]>(
    DEFAULT_TERM_NAMES.map((termName, index) => ({
      termNumber: index + 1,
      name: termName,
      startDate: "",
      endDate: "",
    })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateTerm(index: number, patch: Partial<TermInput>) {
    setTerms((current) => current.map((term, i) => (i === index ? { ...term, ...patch } : term)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSession({ name, startDate, endDate, terms });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add session">
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
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Session start date" htmlFor="session-start-date">
            <Input
              id="session-start-date"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </FormField>
          <FormField label="Session end date" htmlFor="session-end-date">
            <Input
              id="session-end-date"
              type="date"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </FormField>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Terms</p>
          {terms.map((term, index) => (
            <div key={term.termNumber} className="grid grid-cols-3 gap-3 rounded-md border border-gray-200 p-3">
              <FormField label="Name" htmlFor={`term-${term.termNumber}-name`}>
                <Input
                  id={`term-${term.termNumber}-name`}
                  required
                  value={term.name}
                  onChange={(event) => updateTerm(index, { name: event.target.value })}
                />
              </FormField>
              <FormField label="Start date" htmlFor={`term-${term.termNumber}-start`}>
                <Input
                  id={`term-${term.termNumber}-start`}
                  type="date"
                  required
                  value={term.startDate}
                  onChange={(event) => updateTerm(index, { startDate: event.target.value })}
                />
              </FormField>
              <FormField label="End date" htmlFor={`term-${term.termNumber}-end`}>
                <Input
                  id={`term-${term.termNumber}-end`}
                  type="date"
                  required
                  value={term.endDate}
                  onChange={(event) => updateTerm(index, { endDate: event.target.value })}
                />
              </FormField>
            </div>
          ))}
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
