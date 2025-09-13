import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/ui/theme-toggle";

describe("V2-P8 theme toggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    cleanup();
  });

  it("starts on System and stores nothing until a theme is pinned", () => {
    render(<ThemeToggle />);

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(window.localStorage.getItem("theme")).toBeNull();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("pins a theme onto the document element and remembers it", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");
  });

  it("clears the key rather than storing a third value for System", () => {
    // "System" is the absence of an override, not an override of its own. If it
    // were stored as a value the CSS would need a third branch, and a reader
    // who changed their OS theme would stay stuck on whichever one they had.
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(window.localStorage.getItem("theme")).toBe("light");

    fireEvent.click(screen.getByRole("radio", { name: "System" }));
    expect(window.localStorage.getItem("theme")).toBeNull();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("adopts a previously stored preference on mount", async () => {
    window.localStorage.setItem("theme", "dark");
    render(<ThemeToggle />);

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked(),
    );
  });

  it("ignores a stored value that is not a theme", async () => {
    window.localStorage.setItem("theme", "sepia");
    render(<ThemeToggle />);

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "System" })).toBeChecked(),
    );
  });
});
