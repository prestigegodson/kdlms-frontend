import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChangePasswordDialog } from "@/features/auth/ChangePasswordDialog";
import type { AuthenticatedUser } from "@/stores/authStore";
import { useAuthStore } from "@/stores/authStore";
import { initialsOf } from "@/utils/initials";

interface UserMenuProps {
  user: AuthenticatedUser;
}

/**
 * The account menu reachable from every portal's header (see PortalShell) -
 * an avatar button that opens a dropdown with the signed-in user's name and
 * role plus their account actions (change password, log out). Dismissal
 * mirrors components/ui/Modal.tsx: a transparent full-screen overlay behind
 * the panel closes it on click, and Escape closes it and returns focus to
 * the trigger.
 */
export function UserMenu({ user }: UserMenuProps) {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // The panel needs DOM focus for its own onKeyDown to see Escape at all -
  // otherwise focus is still on the trigger button, which never sees a key
  // dispatched while the menu is open (same reasoning as Modal.tsx).
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleLogout() {
    close();
    logout();
    navigate("/login", { replace: true });
  }

  function handleChangePassword() {
    setOpen(false);
    setChangePasswordOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      close();
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold
          text-brand-700 hover:bg-brand-100"
      >
        {initialsOf(user)}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
          <div
            ref={panelRef}
            role="menu"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-gray-200 bg-white py-1
              shadow-lg outline-none"
          >
            <div className="border-b border-gray-100 px-4 py-2">
              <p className="text-sm font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{user.role}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={handleChangePassword}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Change password
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        </>
      )}

      <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </div>
  );
}
