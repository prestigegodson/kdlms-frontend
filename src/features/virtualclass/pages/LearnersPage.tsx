import { KeyRound, Mail, Plus, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type Learner,
  type LearnerCredentials,
  type LearnerRoster,
  type LearnerStatus,
  addLearner,
  listLearners,
  removeLearner,
  resendLearnerInvite,
  resetLearnerPassword,
} from "@/api/learners";
import { type VirtualClass, listVirtualClasses } from "@/api/virtualClasses";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { AddLearnerModal } from "../components/AddLearnerModal";
import { LearnerCredentialsNotice } from "../components/LearnerCredentialsNotice";

const STATUS_BADGES: Record<LearnerStatus, { label: string; variant: "success" | "info" | "warning" }> = {
  ACTIVE: { label: "Active", variant: "success" },
  INVITED: { label: "Invited", variant: "info" },
  INVITE_EXPIRED: { label: "Invite expired", variant: "warning" },
};

function contactLine(learner: Learner): string {
  switch (learner.kind) {
    case "ADULT":
      return learner.email ?? "";
    case "MINOR_WITH_GUARDIAN":
      return learner.guardians.length > 0
        ? `Guardian: ${learner.guardians.map((g) => g.name).join(", ")}`
        : `Guardian: ${learner.email ?? ""}`;
    case "MINOR_WITH_LOGIN":
      return `Login id: ${learner.loginId ?? ""}`;
  }
}

/** The creator's learner roster (creators.md Phase C5): add, invite, enroll, and remove learners. */
export function LearnersPage() {
  const [roster, setRoster] = useState<LearnerRoster | null>(null);
  const [classes, setClasses] = useState<VirtualClass[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Learner | null>(null);
  const [credentials, setCredentials] = useState<{ learner: Learner; credentials: LearnerCredentials } | null>(
    null,
  );

  const load = useCallback(() => {
    Promise.all([listLearners(), listVirtualClasses()])
      .then(([learners, classList]) => {
        setRoster(learners);
        setClasses(classList.classes.filter((c) => c.status === "ACTIVE" && !c.overLimit));
        setError(null);
      })
      .catch((loadError: unknown) => setError(getErrorMessage(loadError, "Failed to load your learners.")));
  }, []);

  useEffect(load, [load]);

  async function resend(learner: Learner) {
    setNotice(null);
    try {
      await resendLearnerInvite(learner.id);
      setNotice(`A new invitation is on its way for ${learner.firstName}.`);
      load();
    } catch (actionError) {
      setError(getErrorMessage(actionError, "Failed to resend the invitation."));
    }
  }

  async function resetPassword(learner: Learner) {
    setNotice(null);
    try {
      setCredentials({ learner, credentials: await resetLearnerPassword(learner.id) });
    } catch (actionError) {
      setError(getErrorMessage(actionError, "Failed to reset the password."));
    }
  }

  function actionsFor(learner: Learner): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];
    if (learner.status !== "ACTIVE") {
      items.push({ label: "Resend invitation", icon: Mail, onSelect: () => resend(learner) });
    }
    if (learner.kind === "MINOR_WITH_LOGIN") {
      items.push({ label: "Reset password", icon: KeyRound, onSelect: () => resetPassword(learner) });
    }
    items.push({
      label: "Remove learner",
      icon: Trash2,
      variant: "danger",
      separated: items.length > 0,
      onSelect: () => setRemoving(learner),
    });
    return items;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learners"
        description="Everyone taking your classes, and their invitations."
        actions={
          <Button onClick={() => setAdding(true)} disabled={roster === null}>
            <Plus className="h-4 w-4" /> Add learner
          </Button>
        }
      />
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {roster === null && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading learners…
        </div>
      )}
      {roster &&
        (roster.learners.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No learners yet"
            description="Add a learner to invite them and enroll them in your classes."
            action={
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add learner
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Learner</TableHeaderCell>
                <TableHeaderCell>Classes</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roster.learners.map((learner) => {
                const badge = STATUS_BADGES[learner.status];
                return (
                  <TableRow key={learner.id}>
                    <TableCell label="Learner">
                      <div className="font-medium text-slate-900">
                        {learner.firstName} {learner.lastName}
                        {learner.minor && <span className="ml-2 text-xs font-normal text-slate-500">Child</span>}
                      </div>
                      <div className="text-xs text-slate-500">{contactLine(learner)}</div>
                    </TableCell>
                    <TableCell label="Classes" className="text-slate-600">
                      {learner.classes.length > 0 ? learner.classes.map((c) => c.name).join(", ") : "None"}
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell label="Actions">
                      <ActionMenu
                        ariaLabel={`Actions for ${learner.firstName} ${learner.lastName}`}
                        items={actionsFor(learner)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ))}
      {adding && roster && (
        <AddLearnerModal
          guardianAccess={roster.guardianAccess}
          classes={classes}
          onClose={() => {
            setAdding(false);
            load();
          }}
          onSubmit={addLearner}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.firstName} ${removing.lastName}?`}
          confirmLabel="Remove learner"
          variant="danger"
          message="They'll be taken out of all your classes and any open invitation is cancelled. You can add them again later."
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await removeLearner(removing.id);
            setRemoving(null);
            load();
          }}
        />
      )}
      {credentials && (
        <Modal open onClose={() => setCredentials(null)} title="New temporary password">
          <div className="space-y-4">
            <LearnerCredentialsNotice
              learnerName={`${credentials.learner.firstName} ${credentials.learner.lastName}`}
              credentials={credentials.credentials}
            />
            <div className="flex justify-end">
              <Button onClick={() => setCredentials(null)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
