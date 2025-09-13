"use client";

import { useEffect, useState } from "react";

/**
 * The event Chromium fires when the app meets its install criteria. It is not
 * in the DOM lib because it is not standardized, so the two members actually
 * used are declared here rather than reached for through a cast.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * V2-P9 — registers the offline cache and, where the browser offers it, an
 * install affordance.
 *
 * Both halves are deliberately unobtrusive. The worker registers after load so
 * it never competes with first paint, and the install control appears only when
 * the browser has already decided the app is installable — no "add to home
 * screen" banner invented by us, no dismissal state to store, and nothing at
 * all in the browsers that do not fire the event. That also keeps the privacy
 * disclosure honest: this component writes no storage of its own.
 */
export function OfflineReady({ version }: { readonly version: string }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // The version rides on the URL so a release produces a different script
    // URL, which is what makes the browser install a fresh worker and drop the
    // previous cache. See the comment at the top of `public/sw.js`.
    void navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(version)}`)
      .catch(() => {
        // An unavailable worker costs nothing: the app is fully static and
        // works exactly as before, just without the offline cache.
      });
  }, [version]);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const installed = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!installEvent) {
    return null;
  }

  const install = () => {
    void installEvent.prompt();
    // The event can only be used once, so it is dropped either way; if the
    // reader declines, the browser will offer it again on a later visit.
    setInstallEvent(null);
  };

  return (
    <button className="install-app" onClick={install} type="button">
      Install for offline use
    </button>
  );
}
