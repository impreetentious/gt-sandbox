"use client";

import { useEffect, useRef, useState } from "react";

const ONBOARDING_KEY = "seenOnboarding";

export function OnboardingHint() {
  const [visible, setVisible] = useState(false);
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setVisible(window.localStorage.getItem(ONBOARDING_KEY) !== "1");
      } catch {
        setVisible(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // The hint remains dismissible when storage is blocked.
    }
    setVisible(false);
  };

  return (
    <aside aria-labelledby="onboarding-title" className="onboarding-hint">
      <div>
        <p className="eyebrow">First visit</p>
        <h2 id="onboarding-title">Choose first. Open Analysis second.</h2>
        <p>
          The sandbox teaches in that order: act, observe the outcome, then use
          the drawer to name the pattern you just experienced.
        </p>
      </div>
      <button onClick={dismiss} ref={dismissRef} type="button">
        Got it
      </button>
    </aside>
  );
}
