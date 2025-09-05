import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClassroomExperience } from "@/components/classroom/classroom-experience";
import { rational } from "@/engine/rational";
import {
  buildSessionExport,
  serializeSessionExport,
} from "@/state/session-export";

afterEach(cleanup);

describe("classroom experience", () => {
  it("builds a Play assignment link that pins a rival and seed", () => {
    render(<ClassroomExperience />);
    const link = screen.getByLabelText("Assignment link") as HTMLInputElement;
    expect(link.value).toContain("/play/pd/?");
    expect(link.value).toContain("persona=");
  });

  it("switches to an auction deep link", () => {
    render(<ClassroomExperience />);
    fireEvent.change(screen.getByLabelText("Exercise"), {
      target: { value: "auction" },
    });
    const link = screen.getByLabelText("Assignment link") as HTMLInputElement;
    expect(link.value).toContain("/auctions/first-price/");
  });

  it("aggregates an uploaded session file locally", async () => {
    render(<ClassroomExperience />);
    const json = serializeSessionExport(
      buildSessionExport({
        kind: "hot-seat",
        game: "pd",
        title: "Prisoner's Dilemma",
        rowLabel: "Player 1",
        columnLabel: "Player 2",
        rounds: [
          {
            rowAction: "a",
            columnAction: "b",
            rowPayoff: rational(4n),
            columnPayoff: rational(4n),
          },
        ],
        rowTotal: rational(4n),
        columnTotal: rational(4n),
      }),
    );
    const file = new File([json], "student.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getByLabelText("Add session files"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("classroom-aggregate")).toBeInTheDocument(),
    );
    expect(screen.getByText(/1 session loaded/)).toBeInTheDocument();
  });
});
