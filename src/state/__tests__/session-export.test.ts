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
    const result = parseSessionExport(
      JSON.stringify({ schema: "something-else", version: 1 }),
    );
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
