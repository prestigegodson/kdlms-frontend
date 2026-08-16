import { LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getSupportContact, type SupportContactView } from "@/api/supportContact";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; contact: SupportContactView }
  | { kind: "error"; message: string };

/** Read-only view of the platform's support contact, for SCHOOL_ADMIN/BRANCH_ADMIN to reach KDLMS support. */
export function SupportPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    getSupportContact()
      .then((contact) => setState({ kind: "loaded", contact }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load support contact",
        }),
      );
  }, []);

  const contact = state.kind === "loaded" ? state.contact : null;
  const hasAnyContact = !!(contact?.supportEmail || contact?.supportPhone || contact?.whatsappNumber);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Support" description="Reach the KDLMS platform team." />

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading support contact…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}

      {state.kind === "loaded" && !hasAnyContact && (
        <EmptyState
          icon={LifeBuoy}
          title="No support contact yet"
          description="Support contact details haven't been published yet."
        />
      )}

      {state.kind === "loaded" && hasAnyContact && (
        <Card>
          <ul className="divide-y divide-slate-200">
            {contact?.supportEmail && (
              <li>
                <a
                  href={`mailto:${contact.supportEmail}`}
                  className="flex min-h-11 items-center gap-3 py-3 text-sm text-slate-900 hover:text-brand-600"
                >
                  <Mail className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="text-xs font-medium text-slate-500">Email</span>
                    <span>{contact.supportEmail}</span>
                  </span>
                </a>
              </li>
            )}
            {contact?.supportPhone && (
              <li>
                <a
                  href={`tel:${contact.supportPhone}`}
                  className="flex min-h-11 items-center gap-3 py-3 text-sm text-slate-900 hover:text-brand-600"
                >
                  <Phone className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="text-xs font-medium text-slate-500">Phone</span>
                    <span>{contact.supportPhone}</span>
                  </span>
                </a>
              </li>
            )}
            {contact?.whatsappNumber && (
              <li>
                <a
                  href={`https://wa.me/${contact.whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center gap-3 py-3 text-sm text-slate-900 hover:text-brand-600"
                >
                  <MessageCircle className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="text-xs font-medium text-slate-500">WhatsApp</span>
                    <span>{contact.whatsappNumber}</span>
                  </span>
                </a>
              </li>
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}
