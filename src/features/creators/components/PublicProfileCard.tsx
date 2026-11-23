import { type FormEvent, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type CreatorProfile,
  type HandleAvailability,
  PUBLIC_CONTACT_PLATFORM_LABELS,
  PUBLIC_CONTACT_PLATFORMS,
  PUBLIC_HANDLE_PATTERN,
  type PublicContactLink,
  type PublicContactPlatform,
  checkPublicHandle,
  updateMyPublicProfile,
} from "@/api/creators";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { publicProfileUrl } from "@/features/creators/publicProfile";

const AVAILABILITY_DEBOUNCE_MS = 400;

const PLACEHOLDERS: Record<PublicContactPlatform, string> = {
  EMAIL: "you@example.com",
  PHONE: "+234 803 000 0000",
  WHATSAPP: "+234 803 000 0000",
  WEBSITE: "https://example.com",
  FACEBOOK: "https://facebook.com/yourpage",
  INSTAGRAM: "https://instagram.com/yourname",
  X: "https://x.com/yourname",
  LINKEDIN: "https://linkedin.com/in/yourname",
  YOUTUBE: "https://youtube.com/@yourchannel",
  TIKTOK: "https://tiktok.com/@yourname",
};

interface PublicProfileCardProps {
  profile: CreatorProfile;
  onSaved: (profile: CreatorProfile) => void;
}

type Availability =
  { kind: "idle" } | { kind: "checking" } | { kind: "checked"; result: HandleAvailability };

/** The last availability answer, tagged with the handle it was for. */
type Checked = { handle: string; result: HandleAvailability };

/**
 * The tutor's public profile page settings: its link name, whether it's published, whether it
 * takes join requests, and the contact links it shows. Saved together with one button.
 */
export function PublicProfileCard({ profile, onSaved }: PublicProfileCardProps) {
  const [handle, setHandle] = useState(profile.publicHandle ?? profile.suggestedHandle);
  const [enabled, setEnabled] = useState(profile.publicProfileEnabled);
  const [joinRequestsEnabled, setJoinRequestsEnabled] = useState(profile.joinRequestsEnabled);
  const [links, setLinks] = useState<PublicContactLink[]>(profile.publicLinks);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const normalized = handle.trim().toLowerCase();
  const savedHandle = profile.publicHandle;
  const wellFormed = PUBLIC_HANDLE_PATTERN.test(normalized);
  const changedHandle = normalized !== (savedHandle ?? "");

  const needsCheck = wellFormed && normalized !== savedHandle;
  const availability: Availability = !needsCheck
    ? { kind: "idle" }
    : checked?.handle === normalized
      ? { kind: "checked", result: checked.result }
      : { kind: "checking" };

  useEffect(() => {
    if (!needsCheck) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      checkPublicHandle(normalized)
        .then((result) => {
          if (!cancelled) setChecked({ handle: normalized, result });
        })
        .catch(() => {
          // Unknown - let the save itself be the judge.
          if (!cancelled)
            setChecked({
              handle: normalized,
              result: { handle: normalized, available: true, reason: null },
            });
        });
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalized, needsCheck]);

  const unavailable = availability.kind === "checked" && !availability.result.available;
  const usedPlatforms = new Set(links.map((link) => link.platform));
  const nextPlatform = PUBLIC_CONTACT_PLATFORMS.find((platform) => !usedPlatforms.has(platform));
  const livePage = profile.publicProfileEnabled && savedHandle !== null;
  const liveUrl = savedHandle ? publicProfileUrl(savedHandle) : null;

  function handleHint(): string {
    if (normalized === "") return "Choose a link name to publish your page.";
    if (!wellFormed)
      return "3-40 lowercase letters, digits or hyphens; it can't start or end with a hyphen.";
    if (availability.kind === "checking") return "Checking…";
    if (availability.kind === "checked") {
      return availability.result.available
        ? "Available."
        : (availability.result.reason ?? "Not available.");
    }
    if (changedHandle && savedHandle) return "Changing it breaks links you've already shared.";
    return publicProfileUrl(normalized);
  }

  function updateLink(index: number, next: PublicContactLink) {
    setLinks((current) => current.map((link, i) => (i === index ? next : link)));
  }

  function moveLink(index: number, offset: -1 | 1) {
    setLinks((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateMyPublicProfile({
        handle: normalized === "" ? null : normalized,
        enabled,
        joinRequestsEnabled,
        links: links
          .map((link) => ({ platform: link.platform, value: link.value.trim() }))
          .filter((link) => link.value !== ""),
      });
      setHandle(updated.publicHandle ?? updated.suggestedHandle);
      setLinks(updated.publicLinks);
      setSaved(true);
      onSaved(updated);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save your public page."));
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (!liveUrl) return;
    void navigator.clipboard?.writeText(liveUrl).then(() => setCopied(true));
  }

  return (
    <Card>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <h2 className="font-display text-base font-medium text-slate-900">Public profile</h2>
          <p className="text-sm text-slate-500">
            A page anyone can open - your business name, logo, banner, bio and the contact links you
            choose. Share its link anywhere. Your address and mobile number are never shown.
          </p>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        {saved && <Alert variant="success">Public page updated.</Alert>}
        {livePage && liveUrl && (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Your page is live</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                aria-label="Your public page link"
                value={liveUrl}
                onFocus={(event) => event.target.select()}
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={copyLink}>
                  {copied ? "Copied!" : "Copy link"}
                </Button>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md px-3 text-sm font-medium text-brand-500 hover:text-brand-600"
                >
                  View page
                </a>
              </div>
            </div>
          </div>
        )}
        <Switch
          label="Publish my public page"
          hint="Off: the link shows “page not available”."
          checked={enabled}
          onChange={setEnabled}
        />
        <FormField label="Link name" htmlFor="public-handle" description={handleHint()}>
          <div className="flex items-stretch">
            <span className="hidden items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 sm:flex">
              /tutors/
            </span>
            <Input
              id="public-handle"
              aria-describedby="public-handle-description"
              aria-invalid={unavailable || (normalized !== "" && !wellFormed)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              className="sm:rounded-l-none"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
            />
          </div>
        </FormField>
        <Switch
          label="Accept join requests"
          hint="Visitors can send you their name and email; you'll get an email and see them under Join requests."
          checked={joinRequestsEnabled}
          onChange={setJoinRequestsEnabled}
        />
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-slate-900">Contact links</legend>
          <p className="text-xs text-slate-500">
            Shown on your page in this order. Leave a row blank to drop it.
          </p>
          {links.map((link, index) => (
            <div key={link.platform} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                aria-label={`Contact ${index + 1} platform`}
                className="sm:w-40"
                value={link.platform}
                onChange={(event) =>
                  updateLink(index, {
                    ...link,
                    platform: event.target.value as PublicContactPlatform,
                  })
                }
              >
                {PUBLIC_CONTACT_PLATFORMS.filter(
                  (platform) => platform === link.platform || !usedPlatforms.has(platform),
                ).map((platform) => (
                  <option key={platform} value={platform}>
                    {PUBLIC_CONTACT_PLATFORM_LABELS[platform]}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={`${PUBLIC_CONTACT_PLATFORM_LABELS[link.platform]} ${
                  link.platform === "EMAIL"
                    ? "address"
                    : link.platform === "PHONE" || link.platform === "WHATSAPP"
                      ? "number"
                      : "link"
                }`}
                type={
                  link.platform === "EMAIL"
                    ? "email"
                    : link.platform === "PHONE" || link.platform === "WHATSAPP"
                      ? "tel"
                      : "url"
                }
                autoCapitalize="none"
                maxLength={300}
                placeholder={PLACEHOLDERS[link.platform]}
                value={link.value}
                onChange={(event) => updateLink(index, { ...link, value: event.target.value })}
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Move ${PUBLIC_CONTACT_PLATFORM_LABELS[link.platform]} up`}
                  disabled={index === 0}
                  onClick={() => moveLink(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Move ${PUBLIC_CONTACT_PLATFORM_LABELS[link.platform]} down`}
                  disabled={index === links.length - 1}
                  onClick={() => moveLink(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remove ${PUBLIC_CONTACT_PLATFORM_LABELS[link.platform]}`}
                  onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {nextPlatform && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setLinks((current) => [...current, { platform: nextPlatform, value: "" }])
              }
            >
              Add contact link
            </Button>
          )}
        </fieldset>
        <Button type="submit" loading={saving} disabled={unavailable || (enabled && !wellFormed)}>
          {saving ? "Saving…" : "Save public page"}
        </Button>
      </form>
    </Card>
  );
}
