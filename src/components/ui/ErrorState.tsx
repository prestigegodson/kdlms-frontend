import { RotateCw } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

interface ErrorStateProps {
  message: string;
  /** Omit for an error with no retry path (e.g. a form-submit failure already shown inline). */
  onRetry?: () => void;
  retrying?: boolean;
}

/**
 * A page-level load failure with a Retry action - `Alert` alone (used
 * elsewhere for this) has no way to recover without a full page reload.
 * Prefer this over a bare `<Alert variant="error">` for anything that
 * failed a GET on mount, not for inline form/action errors.
 */
export function ErrorState({ message, onRetry, retrying = false }: ErrorStateProps) {
  return (
    <Alert variant="error">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry} loading={retrying}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </Button>
        )}
      </div>
    </Alert>
  );
}
