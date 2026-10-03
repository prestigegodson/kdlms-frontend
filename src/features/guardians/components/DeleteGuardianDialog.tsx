import { useEffect, useState } from "react";
import {
  deleteGuardian,
  type GuardianDeletionEligibilityView,
  type GuardianView,
  getGuardianDeletionEligibility,
} from "@/api/guardians";
import { getErrorMessage } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";

interface DeleteGuardianDialogProps {
  guardian: GuardianView;
  onClose: () => void;
  onDeleted: () => void;
}

type EligibilityState =
  | { kind: "loading" }
  | { kind: "loaded"; eligibility: GuardianDeletionEligibilityView }
  | { kind: "error"; message: string };

/**
 * Checks the server's deletion eligibility first, then either asks for
 * confirmation or explains why the guardian can't be deleted (a fee payment
 * they submitted at this school) and points at Disable instead.
 */
export function DeleteGuardianDialog({ guardian, onClose, onDeleted }: DeleteGuardianDialogProps) {
  const [state, setState] = useState<EligibilityState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getGuardianDeletionEligibility(guardian.id)
      .then((eligibility) => {
        if (!cancelled) setState({ kind: "loaded", eligibility });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: "error", message: getErrorMessage(error, "Couldn't check this guardian") });
      });
    return () => {
      cancelled = true;
    };
  }, [guardian.id]);

  if (state.kind === "loaded" && state.eligibility.deletable) {
    return (
      <ConfirmDialog
        title="Delete this guardian?"
        message={
          <>
            <strong>{guardian.fullName}</strong> ({guardian.email}) will be permanently removed from this school,
            along with their links to their wards. Their login is also removed, unless they have children at
            another school. This cannot be undone.
          </>
        }
        confirmLabel="Delete guardian"
        variant="danger"
        onConfirm={async () => {
          await deleteGuardian(guardian.id);
          onDeleted();
          onClose();
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title="Delete this guardian?">
      <div className="space-y-4">
        {state.kind === "loading" && <p className="text-sm text-slate-500">Checking whether this guardian can be deleted…</p>}
        {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
        {state.kind === "loaded" && (
          <Alert variant="warning">
            <strong>{guardian.fullName}</strong> can't be deleted: {state.eligibility.blockers.join("; ")}. Disable
            them instead to remove their access to this school.
          </Alert>
        )}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
