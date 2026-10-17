import { describe, expect, it } from "vitest";
import { rational } from "@/engine/rational";
import { buildAssignmentPath } from "@/state/assignment";
import {
  aggregateSubmissions,
  ingestSessionFile,
  submissionsToCsv,
  type ClassroomSubmission,
} from "@/state/classroom";
import { buildSessionExport, serializeSessionExport } from "@/state/session-export";

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

  it("rejects a total that cannot be parsed back into an exact rational", () => {
    for (const total of ["abc", "1/0", "", "  ", "NaN", "1e5", "0.5"]) {
      const session = JSON.parse(sessionFile("pd", 3));
      const result = ingestSessionFile("bad.json", JSON.stringify({ ...session, rowTotal: total }));

      expect(result.ok).toBe(false);
    }
  });

  it("rejects a round whose payoff is not an exact rational", () => {
    const session = JSON.parse(sessionFile("pd", 3));
    const result = ingestSessionFile(
      "bad.json",
      JSON.stringify({
        ...session,
        rounds: [{ ...session.rounds[0], rowPayoff: "three" }],
      }),
    );

    expect(result.ok).toBe(false);
  });

  it("keeps aggregation and CSV total on every file the ingest accepted", () => {
    // The aggregator's contract is that a bad file is skipped, not that it takes
    // the page down; anything ingest lets through must survive both consumers.
    const accepted: ClassroomSubmission[] = [];
    for (const total of ["abc", "1/0", "3"]) {
      const session = JSON.parse(sessionFile("pd", 3));
      const result = ingestSessionFile("f.json", JSON.stringify({ ...session, rowTotal: total }));
      if (result.ok) accepted.push(result.submission);
    }

    expect(accepted).toHaveLength(1);
    expect(() => aggregateSubmissions(accepted)).not.toThrow();
    expect(() => submissionsToCsv(accepted)).not.toThrow();
  });

  it("neutralizes spreadsheet formulas coming from submitted files", () => {
    const session = JSON.parse(sessionFile("pd", -3));
    const submissions: ClassroomSubmission[] = [
      {
        filename: "=cmd|calc.json",
        session: {
          ...session,
          title: '=HYPERLINK("http://example.test","click")',
          rowLabel: "+1+1",
          columnLabel: "@SUM(A1)",
        },
      },
    ];
    const row = submissionsToCsv(submissions).split("\n")[1];

    expect(row).toContain("'=cmd|calc.json");
    expect(row).toContain("'+1+1");
    expect(row).toContain("'@SUM(A1)");
    expect(row).toContain('"\'=HYPERLINK(""http://example.test"",""click"")"');
    // A negative total is a number, not a formula, and stays usable as one.
    expect(row.split(",")).toContain("-3");
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
    expect(buildAssignmentPath({ surface: "auction", target: "common-value" })).toBe(
      "/auctions/common-value/",
    );
  });

  it("rejects unknown targets", () => {
    expect(() => buildAssignmentPath({ surface: "auction", target: "nope" })).toThrow();
  });
});

describe("bounded classroom evidence", () => {
  it("pools payoff over played rounds and discloses mixed lengths and metadata", () => {
    const one = JSON.parse(sessionFile("pd", 3));
    const two = {
      ...one,
      meta: { persona: "second" },
      rowTotal: "6",
      rounds: [one.rounds[0], { ...one.rounds[0], round: 2 }],
    };
    const zero = { ...one, rowTotal: "0", columnTotal: "0", rounds: [] };
    const aggregate = aggregateSubmissions(
      [one, two, zero].map((session, i) => ({ filename: `${i}.json`, session })),
    );
    expect(aggregate.byGame[0].meanRowPerRound).toEqual(rational(3n));
    expect(aggregate.byGame[0].roundRange).toEqual([0, 2]);
    expect(aggregate.byGame[0].metadata).toHaveLength(2);
    expect(
      aggregateSubmissions([{ filename: "0", session: zero }]).byGame[0].meanRowPerRound,
    ).toBeNull();
  });
  it("retains all verified submissions if combined rational arithmetic exceeds its cap", () => {
    const one = JSON.parse(sessionFile("pd", 0));
    const base = 1n << 800n;
    // Each 243-digit denominator is below the 256-character intake cap. The
    // combined denominator requires more than 16,384 bits, so no subset mean is shown.
    const accepted: ClassroomSubmission[] = [];
    for (let i = 0; i < 24; i++) {
      const denominator = base + BigInt(i);
      const session = {
        ...one,
        rowTotal: `1/${denominator}`,
        rounds: [{ ...one.rounds[0], rowPayoff: `1/${denominator}` }],
      };
      const intake = ingestSessionFile(`${i}.json`, JSON.stringify(session));
      expect(intake.ok).toBe(true);
      if (intake.ok) accepted.push(intake.submission);
    }
    const aggregate = aggregateSubmissions(accepted);
    expect(aggregate.count).toBe(24);
    expect(aggregate.byGame[0].meanRowTotal).toBeNull();
    expect(aggregate.byGame[0].unavailable).toContain("16,384-bit");
  });
});
