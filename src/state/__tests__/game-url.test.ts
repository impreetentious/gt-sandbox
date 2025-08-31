import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createNormalFormGame } from "@/engine/game";
import { formatRational } from "@/engine/rational";
import {
  MAX_GAME_URL_BYTES,
  decodeGameSearch,
  draftToGame,
  encodeGameSearch,
  gameToDraft,
  parseBoundedRational,
} from "@/state/game-url";

describe("bounded custom-game URL state", () => {
  it("round-trips exact bounded games and simulation metadata", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        fc.integer({ min: 2, max: 4 }),
        fc.array(fc.integer({ min: -1_000, max: 1_000 }), {
          minLength: 32,
          maxLength: 32,
        }),
        fc.nat({ max: 0xffff_ffff }),
        (rowCount, columnCount, values, seed) => {
          let cursor = 0;
          const game = createNormalFormGame({
            id: "property",
            title: "Property game",
            rowActions: Array.from(
              { length: rowCount },
              (_, index) => `Row ${index + 1}`,
            ),
            columnActions: Array.from(
              { length: columnCount },
              (_, index) => `Column ${index + 1}`,
            ),
            payoffs: Array.from({ length: rowCount }, () =>
              Array.from({ length: columnCount }, () => [
                values[cursor++],
                values[cursor++],
              ]),
            ),
          });
          const search = encodeGameSearch({
            game,
            extras: {
              continuationProbability: 0.95,
              noise: 0.05,
              persona: "tft",
              seed,
            },
          });
          const decoded = decodeGameSearch(`?${search}`);

          expect(decoded.kind).toBe("valid");
          if (decoded.kind !== "valid") {
            return;
          }

          expect(decoded.state.game.rowActions).toEqual(game.rowActions);
          expect(decoded.state.game.columnActions).toEqual(game.columnActions);
          expect(
            decoded.state.game.payoffs.map((row) =>
              row.map((payoff) => payoff.map(formatRational)),
            ),
          ).toEqual(
            game.payoffs.map((row) =>
              row.map((payoff) => payoff.map(formatRational)),
            ),
          );
          expect(decoded.state.extras).toEqual({
            continuationProbability: 0.95,
            noise: 0.05,
            persona: "tft",
            seed,
          });
        },
      ),
      { numRuns: 80 },
    );
  });

  it("rejects malformed, oversized, and over-limit values without partial parsing", () => {
    expect(
      decodeGameSearch(`?v=1&title=x&row=A&row=B&col=A&col=B&p=0,0`),
    ).toMatchObject({ kind: "invalid" });
    expect(
      decodeGameSearch(`?v=1&junk=${"x".repeat(MAX_GAME_URL_BYTES)}`),
    ).toMatchObject({ kind: "invalid" });
    expect(() => parseBoundedRational("9".repeat(20_000))).toThrow(
      /integer, a fraction, or a finite decimal/,
    );
    expect(() => parseBoundedRational("1000001/1")).toThrow(/1,000,000/);
    expect(() => parseBoundedRational("1.1234567")).toThrow(
      /at most 6 decimal places/,
    );
  });

  it("keeps a draft invalid until every label and payoff satisfies the bounds", () => {
    const game = createNormalFormGame({
      id: "draft",
      title: "Draft",
      rowActions: ["A", "B"],
      columnActions: ["L", "R"],
      payoffs: [
        [
          [1, 1],
          [0, 2],
        ],
        [
          [2, 0],
          [1, 1],
        ],
      ],
    });
    const draft = gameToDraft(game);

    expect(draftToGame({ ...draft, rowActions: ["A", "A"] })).toMatchObject({
      ok: false,
      notice: expect.stringContaining("unique"),
    });
    expect(
      draftToGame({
        ...draft,
        payoffs: [[...[...draft.payoffs[0]].slice(0, 1)]],
      }),
    ).toMatchObject({ ok: false });
    expect(draftToGame(draft)).toMatchObject({ ok: true });
  });
});
