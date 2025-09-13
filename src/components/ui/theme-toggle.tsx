"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "theme";

export type ThemePreference = "system" | "light" | "dark";

const options: readonly { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Writes the preference where the CSS can see it.
 *
 * "system" removes the attribute rather than setting it to a third value, so
 * the `prefers-color-scheme` block in `globals.css` takes over unopposed. That
 * is the whole contract between this file and the stylesheet, and it is also
 * what the inline bootstrap in `layout.tsx` reproduces.
 */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;

  if (preference === "system") {
    root.removeAttribute("data-theme");
    return;
  }

  root.setAttribute("data-theme", preference);
}

/**
 * A three-way theme control: follow the system, or pin light or dark.
 *
 * Built from native radios rather than buttons with `aria-pressed`, because a
 * radio group is what this actually is — one choice out of three — and it comes
 * with arrow-key navigation, a single tab stop, and a correct announcement for
 * free. The visual segmented look is applied to the labels; the inputs stay in
 * the accessibility tree and remain visible under forced colours.
 *
 * The initial render deliberately shows "System" regardless of what is stored.
 * The page is already painted in the right theme by then — the inline bootstrap
 * saw to that before first paint — so this only synchronizes the control, and
 * doing it in an effect keeps the static export's markup identical for every
 * visitor.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    // Deferred by a zero timer, matching `OnboardingHint`: the read happens
    // after hydration settles rather than cascading a render inside the effect.
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(THEME_KEY);

        if (isThemePreference(stored)) {
          setPreference(stored);
        }
      } catch {
        // A blocked storage API just means the choice lasts for this page only.
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const choose = (value: ThemePreference) => {
    setPreference(value);
    applyTheme(value);

    try {
      if (value === "system") {
        window.localStorage.removeItem(THEME_KEY);
      } else {
        window.localStorage.setItem(THEME_KEY, value);
      }
    } catch {
      // Same as above: the theme still changes, it just will not be remembered.
    }
  };

  return (
    <fieldset className="theme-toggle">
      <legend>Theme</legend>
      {options.map((option) => (
        <label className="theme-toggle__option" key={option.value}>
          <input
            checked={preference === option.value}
            name="theme"
            onChange={() => choose(option.value)}
            type="radio"
            value={option.value}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
