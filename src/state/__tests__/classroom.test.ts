import { describe, expect, it } from "vitest";
import { rational } from "@/engine/rational";
import { buildAssignmentPath } from "@/state/assignment";
import {
  aggregateSubmissions,
  ingestSessionFile,
  submissionsToCsv,
  type ClassroomSubmission,
} from "@/state/classroom";
import {
  buildSessionExport,
  serializeSessionExport,
} from "@/state/session-export";

function sessionFile(game: string, rowTotal: number): string {
  return serializeSessionExport(
    buildSessionExport({
      kind: "hot-seat",
      game,
      title: game === "pd" ? "Prisoner's Dilemma" : "Stag Hunt",
      rowLabel: "Player 1",
      columnLabel: "Player 2",
      rounds: [
        {
          rowAction: "a",
          columnAction: "b",
          rowPayoff: rational(BigInt(rowTotal)),
          columnPayoff: rational(0n),
        },
      ],
      rowTotal: rational(BigInt(rowTotal)),
      columnTotal: rational(0n),
    }),
  );
}

describe("classroom aggregation", () => {
  it("ingests valid sessions and rejects malformed ones", () => {
    const good = ingestSessionFile("a.json", sessionFile("pd", 4));
    expect(good.ok).toBe(true);

    const bad = ingestSessionFile("b.json", "{not json");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.rejection.filename).toBe("b.json");
    }
  });

  it("computes exact class means grouped by game", () => {
    const submissions: ClassroomSubmission[] = [
      { filename: "1.json", session: JSON.parse(sessionFile("pd", 3)) },
      { filename: "2.json", session: JSON.parse(sessionFile("pd", 6)) },
      { filename: "3.json", session: JSON.parse(sessionFile("stag", 8)) },
    ];
    const aggregate = aggregateSubmissions(submissions);
    expect(aggregate.count).toBe(3);
    expect(aggregate.byGame).toHaveLength(2);

    const pd = aggregate.byGame.find((entry) => entry.game === "pd");
    // (3 + 6) / 2 = 9/2, kept exact.
    expect(pd?.meanRowTotal).toEqual(rational(9n, 2n));
  });

  it("serializes submissions to CSV with a header row", () => {
    const submissions: ClassroomSubmission[] = [
      { filename: "1.json", session: JSON.parse(sessionFile("pd", 3)) },
    ];
    const csv = submissionsToCsv(submissions);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("rowTotal");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("pd");
  });
});

describe("assignment link builder", () => {
  it("pins persona and seed into a Play share link", () => {
    const path = buildAssignmentPath({
      surface: "play",
      target: "pd",
      persona: "always:D",
      seed: 42,
    });
    expect(path.startsWith("/play/pd/?")).toBe(true);
    expect(path).toContain("persona=always%3AD");
    expect(path).toContain("seed=42");
  });

  it("deep-links hot-seat and auction exercises", () => {
    expect(buildAssignmentPath({ surface: "hot-seat", target: "stag" })).toBe(
      "/hot-seat/stag-hunt/",
    );
    expect(
      buildAssignmentPath({ surface: "auction", target: "common-value" }),
    ).toBe("/auctions/common-value/");
  });

  it("rejects unknown targets", () => {
    expect(() =>
      buildAssignmentPath({ surface: "auction", target: "nope" }),
    ).toThrow();
  });
});
