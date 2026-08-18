import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "@fontsource-variable/inter";
import "@fontsource-variable/lexend";
import { router } from "@/routes";
import { initAuth } from "@/stores/authStore";
import { captureInstallPrompt, registerServiceWorker } from "@/utils/installPrompt";
import "@/index.css";

initAuth();
registerServiceWorker();
// Module scope, not inside a component: beforeinstallprompt can fire before
// React has even mounted, so a component-level listener could miss it.
captureInstallPrompt();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
