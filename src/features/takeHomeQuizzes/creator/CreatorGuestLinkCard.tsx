import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  createClassQuizGuestLink,
  getClassQuizGuestLink,
  type GuestLinkView,
  revokeClassQuizGuestLink,
} from "@/api/classTakeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";

interface CreatorGuestLinkCardProps {
  classId: string;
  quizId: string;
  readOnly: boolean;
  draft: boolean;
  revealResultsOnSubmit: boolean;
}

/**
 * One link a tutor shares so people outside the class can take this quiz: a guest gives a full name and
 * optionally an email. Anyone holding the link can start, so it can be revoked; guests already taking
 * the quiz can still finish.
 */
export function CreatorGuestLinkCard({
  classId,
  quizId,
  readOnly,
  draft,
  revealResultsOnSubmit,
}: CreatorGuestLinkCardProps) {
  const [link, setLink] = useState<GuestLinkView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getClassQuizGuestLink(classId, quizId)
      .then((view) => {
        if (!cancelled) setLink(view);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load the guest link");
      });
    return () => {
      cancelled = true;
    };
  }, [classId, quizId]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setLink(await createClassQuizGuestLink(classId, quizId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create the guest link");
    } finally {
      setBusy(false);
    }
  }

  function copy(url: string) {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Card>
      <h2 className="font-display text-base font-medium text-slate-900">Share with guests</h2>
      <p className="mt-1 text-sm text-slate-600">
        Anyone with this link can take the quiz without an account by entering their full name and, if they choose,
        their email. They don&apos;t count towards your class size.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {revealResultsOnSubmit
          ? "This quiz shows guests their score when they submit."
          : "This quiz hides scores on submit, so guests who gave an email are sent their score when you publish results."}
      </p>

      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      {link?.active ? (
        <div className="mt-4 space-y-3">
          {draft && <Alert variant="info">This link opens once the quiz is published.</Alert>}
          {link.url ? (
            <Input readOnly value={link.url} onFocus={(event) => event.target.select()} aria-label="Guest link" />
          ) : (
            <Alert variant="warning">This link can&apos;t be shown again. Create a new one to share it.</Alert>
          )}
          {!readOnly && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmingRevoke(true)}>
                Revoke link
              </Button>
              {link.url ? (
                <Button size="sm" variant="secondary" onClick={() => link.url && copy(link.url)}>
                  {copied ? "Copied!" : "Copy link"}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" loading={busy} onClick={create}>
                  Create new link
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        link &&
        !readOnly && (
          <div className="mt-4">
            <Button size="sm" variant="secondary" loading={busy} onClick={create}>
              Create guest link
            </Button>
          </div>
        )
      )}

      {confirmingRevoke && (
        <ConfirmDialog
          title="Revoke this guest link?"
          message="New guests won't be able to start. Guests already taking the quiz can still finish, and a new link can be created at any time."
          confirmLabel="Revoke link"
          variant="danger"
          onConfirm={async () => {
            await revokeClassQuizGuestLink(classId, quizId);
            setLink({ active: false });
            setConfirmingRevoke(false);
          }}
          onClose={() => setConfirmingRevoke(false)}
        />
      )}
    </Card>
  );
}
