import { useState } from "react";
import type { LearnerCredentials } from "@/api/learners";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/**
 * A minor learner's generated login id and temporary password (creators.md §7.2), shown inline and
 * expanded - unlike `CredentialsReveal`, no email carries these, so the creator must pass them on.
 * Never retrievable again once this unmounts.
 */
export function LearnerCredentialsNotice({
  learnerName,
  credentials,
}: {
  learnerName: string;
  credentials: LearnerCredentials;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(
      `Login id: ${credentials.loginId}\nTemporary password: ${credentials.temporaryPassword}`,
    );
    setCopied(true);
  }

  return (
    <div className="space-y-3">
      <Alert variant="warning" title="Shown only now">
        Share these with {learnerName} or their parent directly. They'll choose their own password the first
        time they sign in.
      </Alert>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Login id</dt>
        <dd>
          <code className="font-mono text-slate-900">{credentials.loginId}</code>
        </dd>
        <dt className="text-slate-500">Temporary password</dt>
        <dd>
          <code className="font-mono text-slate-900">{credentials.temporaryPassword}</code>
        </dd>
      </dl>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? "Copied" : "Copy both"}
      </Button>
    </div>
  );
}
