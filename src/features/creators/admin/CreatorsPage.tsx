import { GraduationCap } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  type CreatorAdminView,
  listCreators,
  onboardCreator,
  type OnboardCreatorResult,
} from "@/api/creators";
import type { Page } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CredentialsReveal } from "@/components/ui/CredentialsReveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { CREATOR_STATUS_VARIANT } from "@/features/creators/admin/creatorStatus";
import { CreatorProfileFields } from "@/features/creators/components/CreatorProfileFields";
import { emptyCreatorProfile } from "@/features/creators/creatorProfileDefaults";

const PAGE_SIZE = 20;

type ListState =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<CreatorAdminView> }
  | { kind: "error"; message: string };

/** System-admin creator directory: search every education creator, onboard a new one. */
export function CreatorsPage() {
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [onboardOpen, setOnboardOpen] = useState(false);

  function fetchCreators() {
    listCreators(query, pageIndex, PAGE_SIZE)
      .then((page) => setState({ kind: "loaded", page }))
      .catch((error: unknown) =>
        setState({ kind: "error", message: error instanceof ApiError ? error.message : "Failed to load creators" }),
      );
  }

  useEffect(fetchCreators, [query, pageIndex]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Creators"
        description="Every education creator on the platform."
        actions={<Button onClick={() => setOnboardOpen(true)}>Onboard creator</Button>}
      />

      <StickySubHeader>
        <FormField
          label="Search"
          htmlFor="creator-search"
          className="min-w-0 flex-1 lg:max-w-xs"
          labelClassName="sr-only lg:not-sr-only"
        >
          <SearchInput
            id="creator-search"
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPageIndex(0);
            }}
            placeholder="Search business, name or email"
          />
        </FormField>
      </StickySubHeader>

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={4} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title={query ? "No matching creators" : "No creators yet"}
          description={query ? "Try a different search." : "Creators appear here once they sign up or are onboarded."}
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Business</TableHeaderCell>
                  <TableHeaderCell>Creator</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((creator) => (
                  <TableRow key={creator.schoolId} to={`/admin/creators/${creator.schoolId}`}>
                    <TableCell label="Business" className="font-medium text-slate-900">
                      {creator.businessName}
                    </TableCell>
                    <TableCell label="Creator">
                      {creator.firstName} {creator.lastName}
                    </TableCell>
                    <TableCell label="Email">
                      {creator.email ?? "-"}
                      {!creator.emailVerified && (
                        <Badge variant="warning" className="ml-2">
                          Unverified
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={CREATOR_STATUS_VARIANT[creator.status]}>{creator.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={state.page} onPageChange={setPageIndex} />
        </>
      )}

      {onboardOpen && (
        <OnboardCreatorModal
          onClose={() => setOnboardOpen(false)}
          onOnboarded={() => {
            setState({ kind: "loading" });
            fetchCreators();
          }}
        />
      )}
    </div>
  );
}

interface OnboardCreatorModalProps {
  onClose: () => void;
  onOnboarded: () => void;
}

/** Creates a verified creator with a temporary password, shown here once (it's emailed too). */
function OnboardCreatorModal({ onClose, onOnboarded }: OnboardCreatorModalProps) {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState(emptyCreatorProfile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardCreatorResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      setResult(await onboardCreator(email, profile));
      onOnboarded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to onboard creator");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <Modal open onClose={onClose} title="Creator onboarded">
        <div className="space-y-4">
          <Alert variant="success">
            {result.creator.businessName} can now sign in. Their login details have been emailed to them.
          </Alert>
          <CredentialsReveal email={result.creator.email ?? email} temporaryPassword={result.temporaryPassword} />
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Onboard a creator">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Login email" htmlFor="onboard-email">
          <Input
            id="onboard-email"
            type="email"
            autoCapitalize="none"
            required
            maxLength={255}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <CreatorProfileFields value={profile} onChange={setProfile} idPrefix="onboard" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? "Creating…" : "Onboard creator"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
