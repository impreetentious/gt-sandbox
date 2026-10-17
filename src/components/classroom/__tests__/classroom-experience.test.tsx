import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassroomExperience } from "@/components/classroom/classroom-experience";
import { rational } from "@/engine/rational";
import { buildSessionExport, serializeSessionExport } from "@/state/session-export";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

    await waitFor(() => expect(screen.getByTestId("classroom-aggregate")).toBeInTheDocument());
    expect(screen.getByText(/1 session loaded/)).toBeInTheDocument();
  });
});

it("skips exact original bytes by default and permits an explicit separate submission", async () => {
  render(<ClassroomExperience />);
  const json = serializeSessionExport(
    buildSessionExport({
      kind: "ipd",
      game: "pd",
      title: "PD",
      rowLabel: "A",
      columnLabel: "B",
      rounds: [],
      rowTotal: rational(0n),
      columnTotal: rational(0n),
    }),
  );
  const files = [
    new File([json], "a.json"),
    new File([json], "b.json"),
    new File([json + " "], "c.json"),
  ];
  fireEvent.change(screen.getByLabelText("Add session files"), { target: { files } });
  await waitFor(() => expect(screen.getByText(/2 sessions loaded/)).toBeInTheDocument());
  expect(screen.getByText(/1 exact duplicate file/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Keep duplicate 1" }));
  expect(screen.getByText(/3 sessions loaded/)).toBeInTheDocument();
  expect(screen.getByText(/Arithmetic is verified/)).toBeInTheDocument();
});

it("rejects an oversized selection before reading and preserves valid files beside failures", async () => {
  render(<ClassroomExperience />);
  fireEvent.change(screen.getByLabelText("Add session files"), {
    target: { files: Array.from({ length: 101 }, () => new File(["{}"], "bad.json")) },
  });
  expect(screen.getByText(/none were read/)).toBeInTheDocument();
  const json = serializeSessionExport(
    buildSessionExport({
      kind: "auction",
      game: "first-price",
      title: "Auction",
      rowLabel: "A",
      columnLabel: "B",
      rounds: [],
      rowTotal: rational(0n),
      columnTotal: rational(0n),
    }),
  );
  fireEvent.change(screen.getByLabelText("Add session files"), {
    target: { files: [new File(["{"], "broken.json"), new File([json], "valid.json")] },
  });
  await waitFor(() => expect(screen.getByText(/1 session loaded/)).toBeInTheDocument());
  expect(screen.getByText(/broken.json/)).toBeInTheDocument();
});
