import { describe, expect, it } from "vitest";
import { chicken } from "@/engine/catalog/chicken";
import { pd } from "@/engine/catalog/pd";
import { stag } from "@/engine/catalog/stag";
import { formatRational } from "@/engine/rational";
import { simulateIteratedMatch } from "@/engine/repeated/iterated-game";

const base = {
  cooperate: { row: 0, column: 0 },
  masterSeed: 12345,
  matchId: "test",
  continuationProbability: 0.9,
  noise: 0,
} as const;

describe("generalized iterated-game engine", () => {
  it("keeps Tit-for-Tat and Always Cooperate at full mutual cooperation on the PD", () => {
    const result = simulateIteratedMatch({
      ...base,
      game: pd.game,
      rowStrategy: "tft",
      columnStrategy: "allc",
      roundCap: 20,
    });
    expect(formatRational(result.mutualCooperationRate)).toBe("1");
    // Every round is (Cooperate, Cooperate) paying 3 each.
    expect(formatRational(result.rowTotal)).toBe(String(result.rounds * 3));
  });

  it("is exactly reproducible from its seed", () => {
    const config = {
      ...base,
      game: pd.game,
      rowStrategy: "gtft",
      columnStrategy: "joss",
      roundCap: 50,
    } as const;
    const a = simulateIteratedMatch(config);
    const b = simulateIteratedMatch(config);
    expect(a.history).toEqual(b.history);
    expect(formatRational(a.rowTotal)).toBe(formatRational(b.rowTotal));
  });

  it("reinterprets the roster over Stag Hunt cooperate labels", () => {
    const result = simulateIteratedMatch({
      ...base,
      game: stag.game,
      rowStrategy: "grim",
      columnStrategy: "allc",
      roundCap: 15,
    });
    // Grim never sees a defection from AllC, so both hold Stag throughout.
    expect(formatRational(result.mutualCooperationRate)).toBe("1");
    expect(formatRational(result.rowTotal)).toBe(String(result.rounds * 4));
  });

  it("flips realized actions under noise while staying deterministic", () => {
    const noisy = simulateIteratedMatch({
      ...base,
      game: pd.game,
      rowStrategy: "allc",
      columnStrategy: "allc",
      noise: 0.1,
      roundCap: 200,
    });
    // With AllC intending cooperation, any defection must come from noise.
    const defections = noisy.history.filter(
      (round) => round.rowSymbol === "D" || round.columnSymbol === "D",
    );
    expect(defections.length).toBeGreaterThan(0);
    const repeat = simulateIteratedMatch({
      ...base,
      game: pd.game,
      rowStrategy: "allc",
      columnStrategy: "allc",
      noise: 0.1,
      roundCap: 200,
    });
    expect(repeat.history).toEqual(noisy.history);
  });

  it("uses a general aspiration so Pavlov carries meaning on Chicken", () => {
    const result = simulateIteratedMatch({
      ...base,
      game: chicken.game,
      rowStrategy: "pavlov",
      columnStrategy: "tft",
      roundCap: 30,
    });
    expect(result.history.length).toBe(result.rounds);
    expect(result.rounds).toBeGreaterThan(0);
  });

  it("rejects non-2×2 games", () => {
    expect(() =>
      simulateIteratedMatch({
        ...base,
        game: {
          ...pd.game,
          rowActions: ["a", "b", "c"],
          payoffs: [...pd.game.payoffs, pd.game.payoffs[0]],
        },
        rowStrategy: "tft",
        columnStrategy: "tft",
      }),
    ).toThrow(/2×2/);
  });
});
