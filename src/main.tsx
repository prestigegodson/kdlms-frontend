import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "@fontsource-variable/inter";
import "@fontsource-variable/lexend";
import { router } from "@/routes";
import { initAuth } from "@/stores/authStore";
import { captureInstallPrompt, registerServiceWorker } from "@/utils/installPrompt";
import { reloadOnce } from "@/utils/reloadOnce";
import "@/index.css";

initAuth();
registerServiceWorker();
// Module scope, not inside a component: beforeinstallprompt can fire before
// React has even mounted, so a component-level listener could miss it.
captureInstallPrompt();

// A lazy route's chunk (React.lazy() in src/routes/*Route.tsx) can 404 once
// a new deploy has replaced it with a differently-hashed file - nginx.conf's
// `/assets/` location now returns a real 404 for this rather than the SPA
// fallback's index.html, so Vite fires this event instead of the import
// silently resolving to HTML. Reloading picks up the current build's own
// index.html, which references the chunks that actually exist.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnce();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
