import { ArrowLeft } from "lucide-react";
import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, getErrorMessage } from "@/api/client";
import { joinLiveSession, type JoinView, MEETING_LINK_REQUIRED_PROBLEM } from "@/api/liveSessions";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { ExternalMeetingPage } from "@/features/virtualclass/pages/ExternalMeetingPage";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

const LiveSessionPage = lazy(() =>
  import("@/features/virtualclass/pages/LiveSessionPage").then((module) => ({
    default: module.LiveSessionPage,
  })),
);

const DirectCallPage = lazy(() =>
  import("@/features/virtualclass/direct/DirectCallPage").then((module) => ({
    default: module.DirectCallPage,
  })),
);

/** The join call's answer for one session - anything for another session (a stale answer) counts as still checking. */
type Gate =
  | { occurrenceId: string; status: "refused"; message: string; linkMissing: boolean }
  | { occurrenceId: string; status: "ready"; session: JoinView };

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

/** A plain full-screen message with a way back - a refused join, or a session this page can't open yet. */
function Notice({
  home,
  variant = "info",
  children,
}: {
  home: string;
  variant?: "info" | "warning" | "error";
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Link
          to={home}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
        <h1 className="font-display text-xl font-semibold text-slate-900">Live session</h1>
        <Alert variant={variant}>{children}</Alert>
      </div>
    </div>
  );
}

/**
 * A virtual class's session (creators.md Phase C6) - full screen, outside every portal layout. It
 * asks the server to join first, since only that says where the session is held: one on the
 * creator's Google Meet/Zoom link gets a plain page with the link, a one-on-one (DIRECT) session
 * lazy-loads the peer-to-peer call page (webrtc-video.md Phase V5), and only a Platform Video
 * Conferencing session lazy-loads the LiveKit room, so LiveKit's client and styles ship only to
 * someone actually entering it. That room page joins again itself, for a fresh token once the
 * viewer has checked their camera and microphone.
 */
export function LiveSessionRoute() {
  const { occurrenceId = "" } = useParams();
  const role = useAuthStore((state) => state.user?.role);
  const home = role ? homePathForRole(role) : "/login";
  const [answer, setAnswer] = useState<Gate | null>(null);

  useEffect(() => {
    let current = true;
    joinLiveSession(occurrenceId)
      .then((session) => {
        if (current) setAnswer({ occurrenceId, status: "ready", session });
      })
      .catch((error: unknown) => {
        if (current) {
          setAnswer({
            occurrenceId,
            status: "refused",
            message: getErrorMessage(error, "We couldn't open this session."),
            linkMissing:
              error instanceof ApiError && error.problem?.type === MEETING_LINK_REQUIRED_PROBLEM,
          });
        }
      });
    return () => {
      current = false;
    };
  }, [occurrenceId]);

  const gate = answer?.occurrenceId === occurrenceId ? answer : null;
  if (gate === null) {
    return <Loading label="Opening session…" />;
  }
  if (gate.status === "refused") {
    return (
      <Notice home={home} variant={gate.linkMissing ? "warning" : "error"}>
        {gate.message}
      </Notice>
    );
  }
  if (gate.session.meetingMode === "DIRECT") {
    // Peer-to-peer WebRTC (webrtc-video.md) - its own chunk; the LiveKit one is never loaded for it.
    return (
      <Suspense fallback={<Loading label="Loading call…" />}>
        <DirectCallPage key={gate.session.occurrenceId} session={gate.session} home={home} />
      </Suspense>
    );
  }
  if (gate.session.meetingMode === "EXTERNAL") {
    return <ExternalMeetingPage session={gate.session} home={home} />;
  }
  return (
    <Suspense fallback={<Loading label="Loading session…" />}>
      <LiveSessionPage />
    </Suspense>
  );
}
