import "@livekit/components-styles";
import { LiveKitRoom, PreJoin, VideoConference, useDataChannel, type LocalUserChoices } from "@livekit/components-react";
import { ArrowLeft, Eye } from "lucide-react";
import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import { joinLiveSession, parseSessionEnding, type JoinView } from "@/api/liveSessions";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

/**
 * A virtual class's live session (creators.md Phase C6, §9). A creator or learner first checks
 * their camera and microphone (LiveKit's `PreJoin`); a guardian joins as an observer with nothing
 * to publish, so skips it. Joining asks the server for a token - which decides whether this caller
 * may enter this session now - and then connects to LiveKit's `VideoConference`. Leaving, or the
 * room closing at the plan's session length, returns to the portal home.
 */
export function LiveSessionPage() {
  const { occurrenceId = "" } = useParams();
  const role = useAuthStore((state) => state.user?.role);
  const navigate = useNavigate();
  const home = role ? homePathForRole(role) : "/login";
  const canPublish = can.publishInLiveSession(role);
  const [session, setSession] = useState<JoinView | null>(null);
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = useCallback(
    async (userChoices: LocalUserChoices | null) => {
      setJoining(true);
      setError(null);
      try {
        const joined = await joinLiveSession(occurrenceId);
        setChoices(userChoices);
        setSession(joined);
      } catch (err) {
        setError(getErrorMessage(err, "We couldn't open this session."));
      } finally {
        setJoining(false);
      }
    },
    [occurrenceId],
  );

  if (session) {
    const audio = canPublish && choices?.audioEnabled ? { deviceId: choices.audioDeviceId || undefined } : false;
    const video = canPublish && choices?.videoEnabled ? { deviceId: choices.videoDeviceId || undefined } : false;
    return (
      <LiveKitRoom
        serverUrl={session.serverUrl}
        token={session.token}
        connect
        audio={audio}
        video={video}
        onDisconnected={() => navigate(home)}
        onError={(err) => setError(err.message)}
        data-lk-theme="default"
        className="flex h-dvh flex-col"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-white">
          <span className="truncate font-medium">{session.className}</span>
          {session.role === "GUARDIAN" && (
            <span className="inline-flex items-center gap-1 text-slate-300">
              <Eye className="h-4 w-4" aria-hidden="true" /> Watching
            </span>
          )}
        </header>
        <SessionEndingNotice />
        <div className="min-h-0 flex-1">
          <VideoConference />
        </div>
      </LiveKitRoom>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Link to={home} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
        <h1 className="font-display text-xl font-semibold text-slate-900">Live session</h1>
        {error && <Alert variant="error">{error}</Alert>}
        {canPublish ? (
          <Card>
            <p className="mb-3 text-sm text-slate-600">Check your camera and microphone, then join.</p>
            <div data-lk-theme="default" className="rounded-md [&_#username]:hidden">
              <PreJoin
                joinLabel={joining ? "Joining…" : "Join session"}
                persistUserChoices={false}
                onSubmit={(values) => void enter(values)}
                onError={(err) => setError(err.message)}
              />
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-slate-700">
              You'll watch this session as an observer: you can see and hear the class, but your camera and
              microphone stay off.
            </p>
            <Button type="button" className="mt-4" loading={joining} onClick={() => void enter(null)}>
              Watch session
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

/** The server's "5 minutes left" data message (the plan's session length), shown over the room. */
function SessionEndingNotice() {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  useDataChannel((message) => {
    const ending = parseSessionEnding(message.payload);
    if (ending) {
      setMinutesLeft(ending.minutesLeft);
    }
  });
  if (minutesLeft === null) {
    return null;
  }
  return (
    <div className="px-4 pb-2">
      <Alert variant="warning">
        This session ends in about {minutesLeft} minutes - your plan's session length is almost up.
      </Alert>
    </div>
  );
}
