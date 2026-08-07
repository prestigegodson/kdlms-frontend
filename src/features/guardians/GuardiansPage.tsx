import { useEffect, useState } from "react";
import { disableGuardian, enableGuardian, type GuardianView, listGuardians } from "@/api/guardians";
import { ApiError } from "@/api/client";
import type { Page } from "@/api/types";
import { can } from "@/auth/permissions";
import { Contact } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useAuthStore } from "@/stores/authStore";
import { GuardianFormModal } from "@/features/guardians/components/GuardianFormModal";
import { WardsModal } from "@/features/guardians/components/WardsModal";

const PAGE_SIZE = 20;

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<GuardianView> }
  | { kind: "error"; message: string };

/** School-portal guardian directory: provision guardian accounts and manage ward links. */
export function GuardiansPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageGuardians(role);

  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GuardianView | null>(null);
  const [viewingWardsOf, setViewingWardsOf] = useState<GuardianView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function fetchGuardians() {
    listGuardians(query, pageIndex, PAGE_SIZE)
      .then((page) => setState({ kind: "loaded", page }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load guardians",
        }),
      );
  }

  useEffect(fetchGuardians, [query, pageIndex]);

  function load() {
    setState({ kind: "loading" });
    fetchGuardians();
  }

  async function toggleActive(guardian: GuardianView) {
    setActionError(null);
    try {
      if (guardian.active) {
        await disableGuardian(guardian.id);
      } else {
        await enableGuardian(guardian.id);
      }
      load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guardians"
        description="Parents and guardians with a portal login, and the students they're linked to."
        actions={canManage && <Button onClick={() => setCreateOpen(true)}>Add guardian</Button>}
      />

      <SearchInput
        value={query}
        onChange={(value) => {
          setQuery(value);
          setPageIndex(0);
        }}
        placeholder="Search name or email"
        className="max-w-sm"
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={5} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={Contact}
          title="No guardians found"
          description="Add a guardian, or adjust your search."
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((guardian) => (
                  <TableRow key={guardian.id}>
                    <TableCell label="Name" className="font-medium text-slate-900">
                      {guardian.fullName}
                    </TableCell>
                    <TableCell label="Email">{guardian.email}</TableCell>
                    <TableCell label="Phone">{guardian.phone ?? "—"}</TableCell>
                    <TableCell label="Status">
                      <Badge variant={guardian.active ? "success" : "neutral"}>
                        {guardian.active ? "ACTIVE" : "DISABLED"}
                      </Badge>
                    </TableCell>
                    <TableCell label="Actions">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="text-brand-500 hover:text-brand-600"
                          onClick={() => setViewingWardsOf(guardian)}
                        >
                          View wards
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            className="text-slate-500 hover:text-slate-700"
                            onClick={() => setEditing(guardian)}
                          >
                            Edit
                          </button>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            className="text-slate-500 hover:text-slate-700"
                            onClick={() => toggleActive(guardian)}
                          >
                            {guardian.active ? "Disable" : "Enable"}
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={state.page} onPageChange={setPageIndex} />
        </>
      )}

      {createOpen && (
        <GuardianFormModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            load();
          }}
        />
      )}
      {editing && (
        <GuardianFormModal
          guardian={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
      {viewingWardsOf && <WardsModal guardian={viewingWardsOf} onClose={() => setViewingWardsOf(null)} />}
    </div>
  );
}

