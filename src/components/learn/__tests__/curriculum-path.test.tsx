import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CurriculumPath } from "@/components/learn/curriculum-path";
import { curriculum, parseProgress } from "@/state/curriculum";

function stored() {
  return parseProgress(window.localStorage.getItem("curriculum"));
}

describe("V2-P10 curriculum path surface", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it("links the first stop and leaves the rest as plain text", () => {
    render(<CurriculumPath />);

    expect(
      screen.getByRole("link", { name: curriculum[0].title }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: curriculum[1].title }),
    ).toBeNull();
    // A locked stop is still listed and still readable — hiding it would make
    // the path feel smaller than it is.
    expect(screen.getByText(curriculum[1].title)).toBeVisible();
  });

  it("opens every stop from the single gate control", () => {
    render(<CurriculumPath />);

    fireEvent.click(screen.getByLabelText("Open every stop now"));

    for (const step of curriculum) {
      expect(screen.getByRole("link", { name: step.title })).toBeVisible();
    }
    expect(stored().gated).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Gating is off; every stop is open.",
    );
  });

  it("unlocks the next stop when one is marked done", () => {
    render(<CurriculumPath />);

    fireEvent.click(screen.getAllByLabelText("Mark this stop done")[0]);

    expect(stored().completed).toEqual([curriculum[0].id]);
    expect(
      screen.getByRole("link", { name: curriculum[1].title }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      `1 of ${curriculum.length} stops done. Next: ${curriculum[1].title}.`,
    );
  });

  it("counts following a stop's link as doing it", () => {
    render(<CurriculumPath />);

    fireEvent.click(screen.getByRole("link", { name: curriculum[0].title }));

    expect(stored().completed).toEqual([curriculum[0].id]);
  });

  it("restores stored progress on mount", async () => {
    window.localStorage.setItem(
      "curriculum",
      JSON.stringify({ gated: true, completed: [curriculum[0].id] }),
    );

    render(<CurriculumPath />);

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: curriculum[1].title }),
      ).toBeVisible(),
    );
  });

  it("removes the key outright when the path is restarted", async () => {
    render(<CurriculumPath />);

    fireEvent.click(screen.getAllByLabelText("Mark this stop done")[0]);
    expect(window.localStorage.getItem("curriculum")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Start the path over" }),
    );

    expect(window.localStorage.getItem("curriculum")).toBeNull();
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: curriculum[1].title }),
      ).toBeNull(),
    );
  });
});
