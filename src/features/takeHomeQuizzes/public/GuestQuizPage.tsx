import { LinkIcon } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ApiError, GENERIC_ERROR_MESSAGE, getErrorMessage } from "@/api/client";
import {
  getGuestQuizLanding,
  getGuestQuizReview,
  getGuestQuizSession,
  guestQuizImageUrl,
  guestQuizLinkImageUrl,
  heartbeatGuestQuiz,
  pauseGuestQuiz,
  resumeGuestQuiz,
  saveGuestQuizAnswers,
  startGuestQuiz,
  submitGuestQuiz,
  type GuestQuizLandingView,
} from "@/api/guestQuiz";
import type { QuizAttemptView } from "@/api/publicTakeHomeQuiz";
import type { QuizThemeStyle } from "@/api/quizThemes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import { QuizResultReveal } from "@/features/takeHomeQuizzes/components/QuizResultReveal";
import { SubmitConfirmation } from "@/features/takeHomeQuizzes/public/components/SubmitConfirmation";
import { QuizRunner } from "@/features/takeHomeQuizzes/runner/QuizRunner";
import { QUIZ_IMAGE_SIZE_CLASS } from "@/features/takeHomeQuizzes/runner/quizImageSizes";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";
import { hasPassages } from "@/features/takeHomeQuizzes/runner/stimulusGroups";
import { QuizThemeFrame } from "@/features/takeHomeQuizzes/theme/QuizThemeFrame";
import type { ThemeImageSource } from "@/features/takeHomeQuizzes/theme/themeImages";
import { timeLimitLabel } from "@/features/takeHomeQuizzes/timeLimitLabel";
import { formatInstant } from "@/utils/date";

type Status =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "form"; landing: GuestQuizLandingView }
  | { kind: "inProgress"; attempt: QuizAttemptView }
  | { kind: "submitted"; revealResults: boolean; hasEmail: boolean }
  | { kind: "error"; message: string };

const SESSION_KEY_PREFIX = "kdlms.guestQuiz.";

/** Storage can be blocked or cleared - without it a reload just returns to the form. */
function readSession(linkToken: string): string | null {
  try {
    return localStorage.getItem(SESSION_KEY_PREFIX + linkToken);
  } catch {
    return null;
  }
}

function writeSession(linkToken: string, sessionToken: string) {
  try {
    localStorage.setItem(SESSION_KEY_PREFIX + linkToken, sessionToken);
  } catch {
    // Nothing to do: the attempt carries on in this tab.
  }
}

function clearSession(linkToken: string) {
  try {
    localStorage.removeItem(SESSION_KEY_PREFIX + linkToken);
  } catch {
    // Nothing to do.
  }
}

function errorStatus(error: unknown): Status {
  if (error instanceof ApiError) {
    if (error.problem?.type === "https://kdlms.com/problems/too-many-requests") {
      return { kind: "error", message: "Too many requests - please wait a moment and try again." };
    }
    if (error.status === 404) {
      return { kind: "invalid" };
    }
  }
  return { kind: "error", message: getErrorMessage(error, GENERIC_ERROR_MESSAGE) };
}

/**
 * The page a tutor's guest link opens, with no account: a name and an optional email, then the same
 * `QuizRunner` every other way of taking a quiz uses. The link token only shows the quiz and starts an
 * attempt; the session token `start` returns is the guest's own, kept in `localStorage` so reopening
 * the link on this device resumes the attempt, or shows the result once it's released.
 */
export function GuestQuizPage() {
  const [searchParams] = useSearchParams();
  const linkToken = searchParams.get("link") ?? "";

  const [status, setStatus] = useState<Status>(() => (linkToken ? { kind: "loading" } : { kind: "invalid" }));
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<QuizThemeStyle | null>(null);
  // Known once the guest has started or returned, for the confirmation right after submitting.
  const [gaveEmail, setGaveEmail] = useState(false);

  useEffect(() => {
    if (!linkToken) {
      return;
    }
    let cancelled = false;

    async function showLanding() {
      const landing = await getGuestQuizLanding(linkToken);
      if (!cancelled) {
        setTheme(landing.theme ?? null);
        setStatus({ kind: "form", landing });
      }
    }

    async function load() {
      const stored = readSession(linkToken);
      if (!stored) {
        await showLanding();
        return;
      }
      try {
        const session = await getGuestQuizSession(stored);
        if (cancelled) return;
        setSessionToken(stored);
        setTheme(session.theme ?? null);
        setGaveEmail(session.hasEmail);
        if (session.attemptState === "SUBMITTED") {
          setStatus({ kind: "submitted", revealResults: session.revealResults, hasEmail: session.hasEmail });
          return;
        }
        const attempt = await resumeGuestQuiz(stored);
        if (!cancelled) {
          setStatus({ kind: "inProgress", attempt });
        }
      } catch (error) {
        // A session the server no longer knows is the same as none: this device can start afresh.
        if (error instanceof ApiError && error.status === 404) {
          clearSession(linkToken);
          setSessionToken(null);
          await showLanding();
          return;
        }
        throw error;
      }
    }

    load().catch((error: unknown) => {
      if (!cancelled) {
        setStatus(errorStatus(error));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [linkToken]);

  const handleStarted = useCallback(
    (newSessionToken: string, attempt: QuizAttemptView, hasEmail: boolean) => {
      writeSession(linkToken, newSessionToken);
      setSessionToken(newSessionToken);
      setGaveEmail(hasEmail);
      setStatus({ kind: "inProgress", attempt });
    },
    [linkToken],
  );

  const imageUrl = useCallback(
    (fileId: string) =>
      sessionToken ? guestQuizImageUrl(sessionToken, fileId) : guestQuizLinkImageUrl(linkToken, fileId),
    [linkToken, sessionToken],
  );

  const transport: QuizTransport | null = useMemo(
    () =>
      sessionToken
        ? {
            bufferKey: sessionToken,
            saveAnswers: (answers) => saveGuestQuizAnswers(sessionToken, answers),
            submit: (answers) => submitGuestQuiz(sessionToken, answers),
            heartbeat: () => heartbeatGuestQuiz(sessionToken),
            pause: () => pauseGuestQuiz(sessionToken),
            renderQuestionImage: (fileId, alt, size) => (
              <img
                src={guestQuizImageUrl(sessionToken, fileId)}
                alt={alt}
                loading="lazy"
                className={QUIZ_IMAGE_SIZE_CLASS[size]}
              />
            ),
          }
        : null,
    [sessionToken],
  );

  const themeImages: ThemeImageSource = useMemo(() => ({ kind: "url", urlFor: imageUrl }), [imageUrl]);

  const loadReview = useCallback(() => getGuestQuizReview(sessionToken ?? ""), [sessionToken]);
  const renderReviewImage = useCallback(
    (fileId: string, alt: string) => <img src={imageUrl(fileId)} alt={alt} loading="lazy" />,
    [imageUrl],
  );

  if (status.kind === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  if (status.kind === "invalid") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <EmptyState
          icon={LinkIcon}
          title="Link not found"
          description="This quiz link is invalid or no longer active. Ask your tutor for a new one."
        />
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <Alert variant="error">{status.message}</Alert>
      </div>
    );
  }

  return (
    <QuizThemeFrame
      theme={theme}
      images={themeImages}
      variant="page"
      wide={status.kind === "inProgress" && hasPassages(status.attempt)}
    >
      {status.kind === "form" && (
        <GuestDetailsForm linkToken={linkToken} landing={status.landing} onStarted={handleStarted} />
      )}
      {status.kind === "submitted" &&
        (status.revealResults ? (
          <div className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
            <QuizResultReveal load={loadReview} renderImage={renderReviewImage} />
          </div>
        ) : (
          <SubmitConfirmation
            message={
              status.hasEmail
                ? "Your score will be emailed to you when your tutor publishes the results. You can close this page now."
                : "Reopen this link on this device after your tutor publishes the results to see your score."
            }
          />
        ))}
      {status.kind === "inProgress" && transport && (
        <div
          className={`mx-auto min-h-dvh max-w-2xl px-4 py-6 pb-28 ${hasPassages(status.attempt) ? "lg:max-w-6xl" : ""}`}
        >
          <QuizRunner
            initialAttempt={status.attempt}
            transport={transport}
            onSubmitted={(confirmation) =>
              setStatus({ kind: "submitted", revealResults: confirmation.revealResults, hasEmail: gaveEmail })
            }
            onError={(error) => setStatus(errorStatus(error))}
          />
        </div>
      )}
    </QuizThemeFrame>
  );
}

interface GuestDetailsFormProps {
  linkToken: string;
  landing: GuestQuizLandingView;
  onStarted: (sessionToken: string, attempt: QuizAttemptView, hasEmail: boolean) => void;
}

function GuestDetailsForm({ linkToken, landing, onStarted }: GuestDetailsFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const open = landing.availability === "OPEN";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!fullName.trim()) {
      setNameError("Enter your full name.");
      return;
    }
    setNameError(undefined);
    setFormError(null);
    setStarting(true);
    const trimmedEmail = email.trim();
    try {
      const started = await startGuestQuiz(linkToken, {
        fullName,
        email: trimmedEmail || null,
        captchaToken,
        website,
      });
      onStarted(started.sessionToken, started.attempt, Boolean(trimmedEmail));
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 404
          ? "This quiz link is no longer active."
          : getErrorMessage(error, GENERIC_ERROR_MESSAGE),
      );
      // A captcha token is single-use, so a failed start needs a new one.
      setCaptchaToken(null);
      setCaptchaKey((key) => key + 1);
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        {landing.tutorLogoDataUri ? (
          <img
            src={landing.tutorLogoDataUri}
            alt={landing.tutorName}
            className="max-h-14 w-auto max-w-full object-contain"
          />
        ) : (
          <span className="font-display text-lg font-medium text-brand-800">{landing.tutorName}</span>
        )}
      </div>
      <Card>
        <h1 className="font-display text-lg font-medium text-slate-900">{landing.quizTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">{landing.className}</p>

        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Questions</dt>
            <dd className="font-medium text-slate-900">{landing.questionCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Total points</dt>
            <dd className="font-medium text-slate-900">{landing.totalPoints}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Time limit</dt>
            <dd className="font-medium text-slate-900">
              {timeLimitLabel({ timed: landing.timed, durationMinutes: landing.durationMinutes ?? null })}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-500">Closes {formatInstant(landing.closesAt)}</p>

        {!open ? (
          <Alert variant={landing.availability === "SCHEDULED" ? "info" : "warning"} className="mt-4">
            {landing.availability === "SCHEDULED" ? "This quiz is not open yet." : "This quiz has closed."}
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {formError && <Alert variant="error">{formError}</Alert>}
            <FormField label="Full name" htmlFor="guest-full-name" error={nameError}>
              <Input
                id="guest-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                maxLength={200}
                required
              />
            </FormField>
            <FormField
              label="Email (optional)"
              htmlFor="guest-email"
              description={
                landing.revealOnSubmit
                  ? undefined
                  : "Add your email to receive your score when it's published."
              }
            >
              <Input
                id="guest-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={254}
                aria-describedby={landing.revealOnSubmit ? undefined : "guest-email-description"}
              />
            </FormField>
            {/* The honeypot: hidden from people and screen readers, so only a bot fills it in. */}
            <div className="absolute left-[-9999px]" aria-hidden="true">
              <label htmlFor="guest-website">Website</label>
              <input
                id="guest-website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>
            <TurnstileWidget key={captchaKey} onToken={setCaptchaToken} onAvailable={setCaptchaRequired} />
            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={starting}
              disabled={captchaRequired && !captchaToken}
            >
              Start quiz
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
