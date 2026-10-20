import { MailX } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  addSuppression,
  listSuppressions,
  removeSuppression,
  type SuppressionView,
} from "@/api/newsletters";
import type { Page } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { formatInstant } from "@/utils/date";

const PAGE_SIZE = 20;

type State =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<SuppressionView> }
  | { kind: "error"; message: string };

/**
 * Addresses that never get a newsletter - everyone who clicked an unsubscribe link, plus any the
 * admin added by hand. Removing one re-subscribes it. Transactional email (password resets,
 * welcomes, receipts) ignores this list.
 */
export function SuppressionsPage() {
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SuppressionView | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSuppressions(query, pageIndex, PAGE_SIZE)
      .then((page) => {
        if (!cancelled) setState({ kind: "loaded", page });
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ kind: "error", message: getErrorMessage(caught, "Failed to load the list") });
      });
    return () => {
      cancelled = true;
    };
  }, [query, pageIndex, reload]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setAddError(null);
    setAdding(true);
    try {
      await addSuppression(email.trim());
      setEmail("");
      setReload((count) => count + 1);
    } catch (caught) {
      setAddError(getErrorMessage(caught, "Couldn't add that address."));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unsubscribed"
        description="These addresses never get newsletters. Removing one subscribes it again."
        backTo="/admin/newsletters"
      />

      <Card>
        <form onSubmit={(event) => void add(event)} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            aria-label="Email address to unsubscribe"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="sm:max-w-sm"
          />
          <Button type="submit" variant="secondary" loading={adding}>
            Unsubscribe address
          </Button>
        </form>
        {addError && (
          <Alert variant="error" className="mt-3">
            {addError}
          </Alert>
        )}
      </Card>

      <SearchInput
        value={query}
        onChange={(next) => {
          setQuery(next);
          setPageIndex(0);
        }}
        placeholder="Search by email"
        className="w-full sm:w-80"
      />

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={4} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={MailX}
          title="Nobody has unsubscribed"
          description={
            query
              ? "No addresses match your search."
              : "Addresses appear here when someone unsubscribes."
          }
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>How</TableHeaderCell>
                  <TableHeaderCell>Since</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((suppression) => (
                  <TableRow key={suppression.email}>
                    <TableCell label="Email" className="break-all text-slate-900">
                      {suppression.email}
                    </TableCell>
                    <TableCell label="How">
                      <Badge variant="neutral">
                        {suppression.reason === "UNSUBSCRIBED"
                          ? "Unsubscribe link"
                          : "Added by admin"}
                      </Badge>
                    </TableCell>
                    <TableCell label="Since" className="text-sm text-slate-600">
                      {formatInstant(suppression.createdAt)}
                    </TableCell>
                    <TableCell label="Actions">
                      <button
                        type="button"
                        className="inline-flex items-center px-1 text-brand-500 hover:text-brand-600 mobile:min-h-11"
                        onClick={() => setRemoving(suppression)}
                      >
                        Resubscribe
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={state.page} onPageChange={setPageIndex} />
        </>
      )}

      {removing && (
        <ConfirmDialog
          title="Resubscribe this address?"
          message={
            <>
              <strong className="break-all">{removing.email}</strong> will get newsletters again.
              Only do this if they've asked to.
            </>
          }
          confirmLabel="Resubscribe"
          onConfirm={async () => {
            await removeSuppression(removing.email);
            setRemoving(null);
            setReload((count) => count + 1);
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
