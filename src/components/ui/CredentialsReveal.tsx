import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface CredentialsRevealProps {
  email: string;
  temporaryPassword: string;
}

/**
 * A server-generated temporary password, collapsed by default now that a
 * welcome email carries it too (see docs/email.md) - this is the fallback
 * for local/dev setups with no real email provider configured
 * (kdlms.email.provider=log). Shown once, here, and never retrievable
 * again once this component unmounts.
 */
export function CredentialsReveal({ email, temporaryPassword }: CredentialsRevealProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
        onClick={() => setOpen(true)}
      >
        Show credentials (if the welcome email didn't arrive)
      </button>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
      <p>
        <strong>{email}</strong>&apos;s temporary password:{" "}
        <code className="rounded bg-white px-1.5 py-0.5">{temporaryPassword}</code>
      </p>
      <p className="mt-1 text-xs text-gray-500">Shown once, here, and never retrievable again.</p>
      <Button type="button" variant="secondary" className="mt-2" onClick={copyPassword}>
        {copied ? "Copied!" : "Copy password"}
      </Button>
    </div>
  );
}
