import { ArrowLeft, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { endLiveSession, type JoinView } from "@/api/liveSessions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { providerLabel } from "../meeting/meetingLink";

interface ExternalMeetingPageProps {
  session: JoinView;
  /** Where Back (and ending the session) goes - the viewer's portal home. */
  home: string;
}

/**
 * A session held on the creator's own Google Meet/Zoom link: the join call has already recorded a
 * learner's or guardian's attendance, so this just hands over the link. It's a plain link the
 * viewer clicks rather than an automatic redirect - a popup opened after an async call is blocked,
 * and the creator may want to end the session from here afterwards.
 */
export function ExternalMeetingPage({ session, home }: ExternalMeetingPageProps) {
  const navigate = useNavigate();
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const provider = providerLabel(session.meetingProvider);
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Link to={home} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
        <h1 className="font-display text-xl font-semibold text-slate-900">{session.className}</h1>
        <Card>
          <p className="text-sm text-slate-700">This session is held on {provider}.</p>
          {session.role !== "CREATOR" && (
            <p className="mt-1 text-sm text-slate-500">Your attendance has been recorded.</p>
          )}
          {session.meetingUrl ? (
            <a
              href={session.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open in {provider}
            </a>
          ) : (
            <Alert variant="warning" className="mt-4">
              The meeting link for this session isn't available.
            </Alert>
          )}
        </Card>
        {session.role === "CREATOR" && (
          <div>
            <Button type="button" variant="secondary" onClick={() => setConfirmingEnd(true)}>
              Mark session as ended
            </Button>
          </div>
        )}
        {confirmingEnd && (
          <ConfirmDialog
            title="Mark this session as ended?"
            message={`Learners can no longer join it from here. This doesn't close the ${provider} meeting itself.`}
            confirmLabel="Mark as ended"
            onConfirm={async () => {
              await endLiveSession(session.occurrenceId);
              navigate(home);
            }}
            onClose={() => setConfirmingEnd(false)}
          />
        )}
      </div>
    </div>
  );
}
