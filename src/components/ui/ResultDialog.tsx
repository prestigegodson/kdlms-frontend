import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface ResultDialogProps {
  variant: "success" | "error";
  title?: string;
  message: ReactNode;
  closeLabel?: string;
  onClose: () => void;
}

const DEFAULT_TITLE: Record<ResultDialogProps["variant"], string> = {
  success: "Saved",
  error: "Couldn't save",
};

/**
 * A post-action outcome dialog - for a long form whose submit sits far below
 * the top-of-page alert slot (e.g. PeriodGridPage), where a success/error
 * Alert rendered at the top would land off-screen after a click at the
 * bottom. Not a new visual invention: the same Modal + Alert + single "Done"
 * button shape TeachersPage/AdministratorsPage/SchoolDetailPage/
 * GuardianFormModal already use for a post-create result, generalized so a
 * form's save outcome can reuse it too. Always-open like ConfirmDialog - the
 * caller mounts it conditionally rather than passing an `open` prop.
 */
export function ResultDialog({ variant, title, message, closeLabel = "Done", onClose }: ResultDialogProps) {
  return (
    <Modal open onClose={onClose} title={title ?? DEFAULT_TITLE[variant]} size="md">
      <div className="space-y-4">
        <Alert variant={variant}>{message}</Alert>
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={onClose} className="w-full sm:w-auto">
            {closeLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
