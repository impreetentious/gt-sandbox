import { describe, expect, it } from "vitest";
import { rational } from "@/engine/rational";
import {
  buildSessionExport,
  parseSessionExport,
  serializeSessionExport,
  SESSION_EXPORT_SCHEMA,
  SESSION_EXPORT_VERSION,
} from "@/state/session-export";

function sample() {
  return buildSessionExport({
    kind: "hot-seat",
    game: "pd",
    title: "Prisoner's Dilemma",
    seed: 42,
    rowLabel: "Player 1",
    columnLabel: "Player 2",
    rounds: [
      {
        rowAction: "Hold price",
        columnAction: "Undercut",
        rowPayoff: rational(0n),
        columnPayoff: rational(5n),
      },
    ],
    rowTotal: rational(0n),
    columnTotal: rational(5n),
    meta: { mode: "hot-seat", rounds: 1 },
  });
}

describe("session export schema", () => {
  it("round-trips through serialize and parse", () => {
    const original = sample();
    const parsed = parseSessionExport(serializeSessionExport(original));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.session).toEqual(original);
    }
  });

  it("stamps the schema and version", () => {
    const exported = sample();
    expect(exported.schema).toBe(SESSION_EXPORT_SCHEMA);
    expect(exported.version).toBe(SESSION_EXPORT_VERSION);
  });

  it("rejects non-JSON text", () => {
    const result = parseSessionExport("not json");
    expect(result.ok).toBe(false);
  });

  it("rejects a foreign schema", () => {
    const result = parseSessionExport(JSON.stringify({ schema: "something-else", version: 1 }));
    expect(result).toEqual({
      ok: false,
      notice: "This file is not a gt-sandbox session.",
    });
  });

  it("rejects an unsupported version", () => {
    const result = parseSessionExport(
      JSON.stringify({ schema: SESSION_EXPORT_SCHEMA, version: 99 }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed round list", () => {
    const broken = { ...sample(), rounds: [{ round: 1 }] };
    const result = parseSessionExport(JSON.stringify(broken));
    expect(result).toEqual({
      ok: false,
      notice: "This session has a malformed round list.",
    });
  });

  it("rejects a non-primitive seed", () => {
    const broken = { ...sample(), seed: "oops" };
    const result = parseSessionExport(JSON.stringify(broken));
    expect(result.ok).toBe(false);
  });
});

describe("verified transcript intake", () => {
  it("accepts exact fractional sums and equivalent encodings for all kinds", () => {
    for (const kind of ["one-shot", "hot-seat", "ipd", "iterated", "auction"]) {
      const base = sample();
      const rounds = ["1/3", "2/3"].map((rowPayoff, index) => ({
        ...base.rounds[0],
        round: index + 1,
        rowPayoff,
        columnPayoff: "-1/2",
      }));
      const parsed = parseSessionExport(
        JSON.stringify({ ...base, kind, rounds, rowTotal: "2/2", columnTotal: "-1" }),
      );
      expect(parsed.ok).toBe(true);
      expect(
        parseSessionExport(
          JSON.stringify({ ...base, kind, rounds, rowTotal: "2", columnTotal: "-1" }),
        ).ok,
      ).toBe(false);
    }
  });
  it("rejects repeated and skipped round indexes and non-uint32 seeds", () => {
    const base = sample();
    for (const indexes of [[1, 1], [1, 3], [0]]) {
      expect(
        parseSessionExport(
          JSON.stringify({
            ...base,
            rounds: indexes.map((round) => ({ ...base.rounds[0], round })),
          }),
        ).ok,
      ).toBe(false);
    }
    for (const seed of [-1, 1.5, 4294967296])
      expect(parseSessionExport(JSON.stringify({ ...base, seed })).ok).toBe(false);
    expect(parseSessionExport(JSON.stringify({ ...base, seed: 4294967295 })).ok).toBe(true);
  });
  it("accepts zero rounds only with zero declared totals", () => {
    expect(
      parseSessionExport(
        JSON.stringify({ ...sample(), rounds: [], rowTotal: "0", columnTotal: "0" }),
      ).ok,
    ).toBe(true);
    expect(
      parseSessionExport(
        JSON.stringify({ ...sample(), rounds: [], rowTotal: "1", columnTotal: "0" }),
      ).ok,
    ).toBe(false);
  });
  it("enforces exact file, round and rational-string caps", () => {
    const text = JSON.stringify(sample());
    expect(parseSessionExport(text.padEnd(2 * 1024 * 1024, " ")).ok).toBe(true);
    expect(parseSessionExport(text.padEnd(2 * 1024 * 1024 + 1, " ")).ok).toBe(false);
    for (const length of [256, 257]) {
      const total = "0".repeat(length);
      expect(
        parseSessionExport(
          JSON.stringify({ ...sample(), rounds: [], rowTotal: total, columnTotal: "0" }),
        ).ok,
      ).toBe(length === 256);
    }
    for (const count of [10000, 10001]) {
      const rounds = Array.from({ length: count }, (_, i) => ({
        ...sample().rounds[0],
        round: i + 1,
        rowPayoff: "0",
        columnPayoff: "0",
      }));
      expect(
        parseSessionExport(JSON.stringify({ ...sample(), rounds, rowTotal: "0", columnTotal: "0" }))
          .ok,
      ).toBe(count === 10000);
    }
  });
});
