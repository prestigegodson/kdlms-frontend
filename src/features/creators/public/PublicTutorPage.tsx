import { AtSign, Globe, Mail, MessageCircle, Phone } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import { PUBLIC_CONTACT_PLATFORM_LABELS, type PublicContactLink } from "@/api/creators";
import {
  type PublicTutorProfile,
  getPublicTutor,
  publicTutorImageUrl,
  submitJoinRequest,
} from "@/api/publicTutors";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import { contactHref } from "@/features/creators/publicProfile";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; profile: PublicTutorProfile }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

/** A settled load, tagged with the handle it was for - a different handle reads as still loading. */
type Settled = { handle: string; state: LoadState };

/** Mirrors backend creator.domain.JoinRequest.MAX_MESSAGE. */
const MESSAGE_MAX_LENGTH = 2000;

function ContactIcon({ link }: { link: PublicContactLink }) {
  const className = "h-4 w-4 shrink-0";
  switch (link.platform) {
    case "EMAIL":
      return <Mail className={className} aria-hidden="true" />;
    case "PHONE":
      return <Phone className={className} aria-hidden="true" />;
    case "WHATSAPP":
      return <MessageCircle className={className} aria-hidden="true" />;
    case "WEBSITE":
      return <Globe className={className} aria-hidden="true" />;
    default:
      return <AtSign className={className} aria-hidden="true" />;
  }
}

/**
 * A tutor's public profile page (`/tutors/:handle`) - open to anyone, no login. Shows what the
 * tutor chose to publish and, when they take them, a "request to join" form.
 */
export function PublicTutorPage() {
  const { handle = "" } = useParams<{ handle: string }>();
  const [settled, setSettled] = useState<Settled | null>(null);
  const state: LoadState = settled?.handle === handle ? settled.state : { kind: "loading" };

  useEffect(() => {
    let cancelled = false;
    getPublicTutor(handle)
      .then((profile) => {
        if (!cancelled) {
          setSettled({
            handle,
            state: profile ? { kind: "loaded", profile } : { kind: "not-found" },
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSettled({
            handle,
            state: {
              kind: "error",
              message: getErrorMessage(error, "We couldn't load this page."),
            },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const businessName = state.kind === "loaded" ? state.profile.businessName : null;
  useEffect(() => {
    if (!businessName) return;
    const previous = document.title;
    document.title = `${businessName} — KDLMS`;
    return () => {
      document.title = previous;
    };
  }, [businessName]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  if (state.kind === "not-found" || state.kind === "error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-semibold text-slate-900">
          {state.kind === "not-found" ? "This page isn't available" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {state.kind === "not-found"
            ? "The link may be mistyped, or the tutor has taken their page down."
            : state.message}
        </p>
        <Link to="/" className="mt-6 text-sm font-medium text-brand-500 hover:text-brand-600">
          Go to KDLMS
        </Link>
      </main>
    );
  }

  const { profile } = state;
  return (
    <main className="pb-12">
      <div className="h-40 w-full overflow-hidden bg-gradient-to-r from-brand-500 to-brand-400 sm:h-56">
        {profile.bannerVersion && (
          <img
            src={publicTutorImageUrl(profile.handle, "banner", profile.bannerVersion)}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="mx-auto max-w-3xl px-4">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-4 border-white bg-white shadow-sm sm:h-28 sm:w-28">
            {profile.logoVersion ? (
              <img
                src={publicTutorImageUrl(profile.handle, "logo", profile.logoVersion)}
                alt={`${profile.businessName} logo`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span
                className="font-display text-3xl font-semibold text-brand-500"
                aria-hidden="true"
              >
                {profile.businessName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
              {profile.businessName}
            </h1>
            <p className="text-sm text-slate-500">with {profile.tutorName}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_20rem]">
          <section className="space-y-6">
            {profile.bio && (
              <div>
                <h2 className="font-display text-base font-medium text-slate-900">About</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {profile.bio}
                </p>
              </div>
            )}
            {profile.links.length > 0 && (
              <div>
                <h2 className="font-display text-base font-medium text-slate-900">Get in touch</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {profile.links.map((link) => (
                    <li key={link.platform}>
                      <a
                        href={contactHref(link)}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-brand-200 hover:text-brand-600"
                      >
                        <ContactIcon link={link} />
                        {PUBLIC_CONTACT_PLATFORM_LABELS[link.platform]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!profile.bio && profile.links.length === 0 && !profile.joinRequestsEnabled && (
              <p className="text-sm text-slate-500">This tutor hasn't added any details yet.</p>
            )}
          </section>
          {profile.joinRequestsEnabled && (
            <JoinRequestForm handle={profile.handle} businessName={profile.businessName} />
          )}
        </div>

        <p className="mt-12 text-center text-xs text-slate-400">
          Online classes powered by{" "}
          <Link to="/tutors/signup" className="font-medium text-slate-500 hover:text-brand-600">
            KDLMS
          </Link>
        </p>
      </div>
    </main>
  );
}

/**
 * The "request to join" form. The `website` field is a honeypot people never see; a Turnstile
 * token is single-use, so the widget remounts for a fresh one after every failed submit.
 */
function JoinRequestForm({ handle, businessName }: { handle: string; businessName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitJoinRequest(handle, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() === "" ? null : phone.trim(),
        message: message.trim() === "" ? null : message.trim(),
        website,
        captchaToken,
      });
      setSent(true);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "We couldn't send your request. Please try again."));
      setCaptchaToken(null);
      setCaptchaKey((key) => key + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-display text-base font-medium text-slate-900">Request to join</h2>
      {sent ? (
        <div className="mt-3">
          <Alert variant="success">
            Thanks! {businessName} has your request and will get back to you by email.
          </Alert>
        </div>
      ) : (
        <form className="mt-3 space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-slate-500">
            Leave your details and the tutor will get in touch.
          </p>
          {error && <Alert variant="error">{error}</Alert>}
          <FormField label="Your name" htmlFor="join-name">
            <Input
              id="join-name"
              required
              maxLength={200}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <FormField label="Email" htmlFor="join-email">
            <Input
              id="join-email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <FormField label="Phone" htmlFor="join-phone" description="Optional.">
            <Input
              id="join-phone"
              type="tel"
              maxLength={30}
              autoComplete="tel"
              aria-describedby="join-phone-description"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </FormField>
          <FormField
            label="Message"
            htmlFor="join-message"
            description="Optional - who the classes are for, what you'd like to learn."
          >
            <Textarea
              id="join-message"
              rows={4}
              maxLength={MESSAGE_MAX_LENGTH}
              aria-describedby="join-message-description"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </FormField>
          {/* Honeypot: hidden from people and assistive tech, so only a bot fills it in. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="join-website">Website</label>
            <input
              id="join-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          <TurnstileWidget
            key={captchaKey}
            onToken={setCaptchaToken}
            onAvailable={setCaptchaRequired}
          />
          <Button
            type="submit"
            loading={submitting}
            disabled={captchaRequired && !captchaToken}
            className="w-full"
          >
            {submitting ? "Sending…" : "Send request"}
          </Button>
        </form>
      )}
    </aside>
  );
}
