type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
};

interface AvatarProps {
  /** Pre-computed via `utils/initials`' `initialsOf`/`initialsOfFullName` - which one applies depends on what shape of name the caller has. */
  initials: string;
  /** An object URL from `useObjectUrl`, or `null` while loading/absent - falls back to initials either way. */
  url: string | null;
  size?: AvatarSize;
  className?: string;
}

/**
 * A student/ward's photo, or an initials circle when there's no photo (or
 * it hasn't loaded yet). Presentational only - the caller resolves `url`
 * itself via `useObjectUrl` (with `downloadFile` for a staff-visible
 * `fileId`, or `downloadWardPhoto` for a guardian's own ward), since the
 * fetch shape differs by caller and this component shouldn't need to know
 * which one applies.
 */
export function Avatar({ initials, url, size = "md", className = "" }: AvatarProps) {
  const sizeClasses = SIZE_CLASSES[size];
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`shrink-0 rounded-full object-cover ${sizeClasses} ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-600 ${sizeClasses} ${className}`}
    >
      {initials}
    </span>
  );
}
